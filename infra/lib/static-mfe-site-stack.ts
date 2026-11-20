import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Annotations,
  CfnOutput,
  DefaultStackSynthesizer,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  Tags,
  Validations,
} from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

/**
 * Files that must never be cached long-term (ADR 0002 / ADR 0003).
 * Each gets its own CloudFront behaviour with caching disabled and is uploaded
 * with `Cache-Control: no-cache`.
 */
export const NO_CACHE_FILES = ['index.html', 'remoteEntry.js', 'config.json', 'mf-manifest.json'] as const;

export const IMMUTABLE_CACHE_CONTROL = 'public,max-age=31536000,immutable';
export const NO_CACHE_CACHE_CONTROL = 'no-cache';

/**
 * CloudFront Function (viewer-request, cloudfront-js-2.0).
 * Rewrites extensionless paths (no '.' in the last path segment) to /index.html
 * so client-side routes like /dashboard work. Requests for files with an
 * extension pass through untouched, so a missing chunk returns a real 403/404
 * instead of index.html (which would surface as a confusing MIME-type error).
 */
export const SPA_REWRITE_FUNCTION_CODE = `function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}`;

export interface StaticMfeSiteStackProps extends StackProps {
  /** Federation name, e.g. `portal17` or `app19`. Used for tags and descriptions. */
  readonly appName: string;
  /** Repository name, used for tags. */
  readonly repoName: string;
  /** Environment name (dev/staging/prod), used for tags. */
  readonly envName: string;
  /** Absolute path to the Vite build output (dist/). May not exist yet. */
  readonly distPath: string;
  /** Origins allowed to load this app's JS cross-origin (the other app's origin[s]). */
  readonly allowedOrigins: string[];
  /** Optional runtime remotes written to /config.json, e.g. { app19: 'https://dxxx.cloudfront.net/remoteEntry.js' }. */
  readonly remotes?: Record<string, string>;
  /** Dev only: destroy bucket + objects on stack deletion. Default false (RETAIN). */
  readonly destroyOnRemoval?: boolean;
  /** Optional custom domain, e.g. portal.example.com. Requires hostedZoneName, hostedZoneId and certificateArn. */
  readonly domainName?: string;
  readonly hostedZoneName?: string;
  readonly hostedZoneId?: string;
  /** ACM certificate ARN in us-east-1 covering domainName. */
  readonly certificateArn?: string;
}

export class StaticMfeSiteStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StaticMfeSiteStackProps) {
    super(scope, id, {
      description: `Static hosting (S3 + CloudFront) for micro-frontend ${props.appName}`,
      ...props,
    });

    Tags.of(this).add('app', props.appName);
    Tags.of(this).add('repo', props.repoName);
    Tags.of(this).add('env', props.envName);

    const destroy = props.destroyOnRemoval ?? false;

    // ---------------------------------------------------------------- bucket
    this.bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: destroy ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: destroy,
    });

    // ------------------------------------------------------- edge functions
    const spaRewrite = new cloudfront.Function(this, 'SpaRewriteFunction', {
      comment: `${props.appName}: rewrite extensionless paths to /index.html`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(SPA_REWRITE_FUNCTION_CODE),
    });

    // ---------------------------------------------------- response headers
    const headersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'CorsSecurityHeaders', {
      comment: `${props.appName}: CORS for cross-origin module federation + security headers`,
      // CORS on ALL responses (not only remoteEntry.js): the other app loads
      // remoteEntry.js and then dynamically imports hashed chunks from
      // assets/*, and module scripts are always fetched in CORS mode.
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowOrigins: props.allowedOrigins,
        accessControlMaxAge: Duration.minutes(10),
        originOverride: true,
      },
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(730),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN, override: true },
        // CSP intentionally omitted. A CSP for this app must allow the OTHER
        // app's origin in script-src (and connect-src for config/manifest
        // fetches), e.g.
        //   script-src 'self' https://<other-app-domain>; connect-src 'self' https://<other-app-domain>
        // Add it here (start with Content-Security-Policy-Report-Only via
        // customHeadersBehavior) once both domains are stable.
      },
    });

    // -------------------------------------------------------- cache policies
    // Default behaviour. minTtl MUST stay 0: deep links (/dashboard) select the
    // default behaviour BEFORE the viewer-request function rewrites them to
    // /index.html, so the object's own `Cache-Control: no-cache` must win.
    // Hashed assets carry `max-age=31536000,immutable` and are cached 1 year.
    const longTtlPolicy = new cloudfront.CachePolicy(this, 'ImmutableAssetsCachePolicy', {
      comment: `${props.appName}: honour origin Cache-Control; up to 1y for hashed assets`,
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.days(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // ---------------------------------------------------------- distribution
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    const domainNames = this.resolveDomain(props);
    const certificate = props.certificateArn
      ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn)
      : undefined;

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${props.appName} (${props.envName})`,
      defaultRootObject: 'index.html',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // TLSv1.2_2021 only takes effect with a custom certificate; the default
      // *.cloudfront.net certificate has a fixed policy (CDK warns otherwise).
      minimumProtocolVersion: certificate ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      domainNames,
      certificate,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: longTtlPolicy,
        responseHeadersPolicy: headersPolicy,
        compress: true,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      // Deliberately NO errorResponses (403/404 -> index.html); see ADR 0003.
    });

    for (const file of NO_CACHE_FILES) {
      this.distribution.addBehavior(`/${file}`, s3Origin, {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy: headersPolicy,
        compress: true,
      });
    }

    if (domainNames && props.hostedZoneId && props.hostedZoneName) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.hostedZoneName,
      });
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
      new route53.ARecord(this, 'AliasA', { zone, recordName: props.domainName, target });
      new route53.AaaaRecord(this, 'AliasAAAA', { zone, recordName: props.domainName, target });
    }

    // ------------------------------------------------------------ deployment
    this.addDeployments(props);

    // --------------------------------------------------------------- outputs
    const publicHost = props.domainName ?? this.distribution.distributionDomainName;
    new CfnOutput(this, 'DistributionDomainName', { value: this.distribution.distributionDomainName });
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName });
    new CfnOutput(this, 'RemoteEntryUrl', { value: `https://${publicHost}/remoteEntry.js` });

    this.addNagSuppressions();
  }

  private resolveDomain(props: StaticMfeSiteStackProps): string[] | undefined {
    if (!props.domainName) return undefined;
    const missing = (['hostedZoneName', 'hostedZoneId', 'certificateArn'] as const).filter((k) => !props[k]);
    if (missing.length) {
      throw new Error(`domainName=${props.domainName} requires context: ${missing.join(', ')}`);
    }
    if (!props.certificateArn!.includes(':us-east-1:')) {
      throw new Error('certificateArn must be an ACM certificate in us-east-1 (CloudFront requirement)');
    }
    return [props.domainName];
  }

  private addDeployments(props: StaticMfeSiteStackProps): void {
    const dist = props.distPath;
    const hasIndex = fs.existsSync(path.join(dist, 'index.html'));
    const assetsDir = path.join(dist, 'assets');
    const hasAssets = fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory();
    const remotes = props.remotes;

    if (!hasIndex) {
      Annotations.of(this).addWarningV2(
        'mfe-infra:distMissing',
        `No build found at ${dist} (missing index.html). Skipping site upload. ` +
          'Run the app build (npm run build) before deploying, or pass -c distPath=<dir>.',
      );
    }

    // 1) Hashed assets: immutable, 1 year. prune:false keeps old chunks so a
    //    session that already loaded the previous remoteEntry.js/index.html
    //    (including the OTHER app, which loads us cross-origin) can still
    //    fetch the chunks it references after we redeploy.
    let hashed: s3deploy.BucketDeployment | undefined;
    if (hasIndex && hasAssets) {
      hashed = new s3deploy.BucketDeployment(this, 'DeployHashedAssets', {
        sources: [s3deploy.Source.asset(assetsDir)],
        destinationBucket: this.bucket,
        destinationKeyPrefix: 'assets/',
        cacheControl: [s3deploy.CacheControl.fromString(IMMUTABLE_CACHE_CONTROL)],
        prune: false,
        memoryLimit: 512,
      });
    } else if (hasIndex) {
      Annotations.of(this).addWarningV2('mfe-infra:assetsMissing', `No ${assetsDir} directory; only root files will be uploaded.`);
    }

    // 2) Everything outside assets/ (index.html, remoteEntry.js, config.json,
    //    mf-manifest.json, public/ files): no-cache, then invalidate.
    //    When `remotes` is set, dist/config.json is excluded and replaced by the
    //    generated one IN THIS SAME deployment (a separate deployment would not
    //    re-run when only dist changes, letting dist/config.json win).
    const sources: s3deploy.ISource[] = [];
    if (hasIndex) {
      const exclude = ['assets', 'assets/**'];
      if (remotes) exclude.push('config.json');
      sources.push(s3deploy.Source.asset(dist, { exclude }));
    }
    if (remotes) {
      sources.push(s3deploy.Source.jsonData('config.json', { remotes }));
    }
    if (sources.length === 0) return;

    const noCache = new s3deploy.BucketDeployment(this, 'DeployNoCacheFiles', {
      sources,
      destinationBucket: this.bucket,
      cacheControl: [s3deploy.CacheControl.fromString(NO_CACHE_CACHE_CONTROL)],
      prune: false,
      memoryLimit: 512,
      distribution: this.distribution,
      distributionPaths: ['/', ...NO_CACHE_FILES.map((f) => `/${f}`)],
    });
    // New index.html / remoteEntry.js must not go live before the chunks they reference.
    if (hashed) noCache.node.addDependency(hashed);
  }

  /**
   * cdk-nag v3 uses CDK's native Validations.acknowledge(). Each finding is
   * acknowledged with a reason; unacknowledged findings fail `cdk synth`.
   */
  private addNagSuppressions(): void {
    Validations.of(this.bucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason: 'Demo static site: S3 server access logs not required; CloudFront (OAC) is the only reader.',
    });
    Validations.of(this.distribution).acknowledge(
      { id: 'AwsSolutions-CFR1', reason: 'Public demo app; no geo restriction required.' },
      { id: 'AwsSolutions-CFR2', reason: 'WAF optional per ADR 0003 (static assets, no backend). Add a WebACL for prod.' },
      { id: 'AwsSolutions-CFR3', reason: 'Demo: CloudFront access logging off to avoid a log bucket; enable for prod.' },
      {
        id: 'AwsSolutions-CFR4',
        reason: 'With the default *.cloudfront.net certificate CloudFront negotiates TLSv1+; TLSv1.2_2021 applies once a custom domain + ACM cert is configured.',
      },
    );

    // Singleton Lambdas created by BucketDeployment / autoDeleteObjects live at
    // stack scope with generated IDs. cdk-nag v3 needs one acknowledgement per
    // granular finding (no prefix matching), so they are listed explicitly.
    const qualifier: string =
      this.node.tryGetContext('@aws-cdk/core:bootstrapQualifier') ?? DefaultStackSynthesizer.DEFAULT_QUALIFIER;
    const siteBucketLogicalId = this.getLogicalId(this.bucket.node.defaultChild as s3.CfnBucket);
    const providerAcks = [
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'CDK-managed BucketDeployment/AutoDelete Lambda: basic execution role (CloudWatch Logs only).',
      },
      ...['s3:GetBucket*', 's3:GetObject*', 's3:List*', 's3:Abort*', 's3:DeleteObject*'].map((action) => ({
        id: `AwsSolutions-IAM5[Action::${action}]`,
        reason: 'CDK-managed BucketDeployment grant: read from the CDK asset bucket, write to the site bucket.',
      })),
      {
        id: `AwsSolutions-IAM5[Resource::arn:<AWS::Partition>:s3:::cdk-${qualifier}-assets-<AWS::AccountId>-<AWS::Region>/*]`,
        reason: 'BucketDeployment reads uploaded build zips from the CDK bootstrap asset bucket.',
      },
      {
        id: `AwsSolutions-IAM5[Resource::<${siteBucketLogicalId}.Arn>/*]`,
        reason: 'BucketDeployment writes the build output to any key in the site bucket.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason: 'cloudfront:CreateInvalidation/GetInvalidation for the deployment invalidation (CDK-managed policy).',
      },
      { id: 'AwsSolutions-L1', reason: 'Runtime of CDK-managed singleton Lambdas is pinned by aws-cdk-lib.' },
    ];
    for (const child of this.node.children) {
      if (child.node.id.startsWith('Custom::CDKBucketDeployment') || child.node.id.startsWith('Custom::S3AutoDeleteObjects')) {
        Validations.of(child).acknowledge(...providerAcks);
      }
    }
  }
}
