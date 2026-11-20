import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { App, Validations } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { AwsSolutionsChecks } from 'cdk-nag';
import { contextBool, contextStringList, contextStringMap } from '../lib/context';
import {
  IMMUTABLE_CACHE_CONTROL,
  NO_CACHE_CACHE_CONTROL,
  NO_CACHE_FILES,
  SPA_REWRITE_FUNCTION_CODE,
  StaticMfeSiteStack,
  StaticMfeSiteStackProps,
} from '../lib/static-mfe-site-stack';

// Managed policy ID of CloudFront "CachingDisabled".
const CACHING_DISABLED_ID = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad';

let fixtureDist: string;
const missingDist = path.join(os.tmpdir(), 'mfe-infra-test-does-not-exist');

beforeAll(() => {
  fixtureDist = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-infra-dist-'));
  fs.mkdirSync(path.join(fixtureDist, 'assets'));
  fs.writeFileSync(path.join(fixtureDist, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(fixtureDist, 'remoteEntry.js'), 'export const get = () => {};');
  fs.writeFileSync(path.join(fixtureDist, 'config.json'), '{"remotes":{}}');
  fs.writeFileSync(path.join(fixtureDist, 'assets', 'index-abc123.js'), 'console.log(1);');
});

afterAll(() => {
  fs.rmSync(fixtureDist, { recursive: true, force: true });
});

const baseProps = (): StaticMfeSiteStackProps => ({
  appName: 'testapp',
  repoName: 'test-repo',
  envName: 'test',
  distPath: missingDist,
  allowedOrigins: ['https://other.example.com'],
});

function build(overrides: Partial<StaticMfeSiteStackProps> = {}, opts: { nag?: boolean } = {}) {
  const app = new App();
  if (opts.nag) Validations.of(app).addPlugins(new AwsSolutionsChecks(app));
  const stack = new StaticMfeSiteStack(app, 'TestStack', { ...baseProps(), ...overrides });
  return { app, stack, template: Template.fromStack(stack) };
}

function distributionConfig(template: Template): any {
  const dists = template.findResources('AWS::CloudFront::Distribution');
  const ids = Object.keys(dists);
  expect(ids).toHaveLength(1);
  return dists[ids[0]].Properties.DistributionConfig;
}

function deployments(template: Template): Record<string, any> {
  return template.findResources('Custom::CDKBucketDeployment');
}

describe('bucket', () => {
  test('is private, SSL-only, encrypted and retained by default', () => {
    const { template } = build();
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        BucketEncryption: Match.objectLike({}),
        WebsiteConfiguration: Match.absent(),
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
    template.resourceCountIs('Custom::S3AutoDeleteObjects', 0);
  });

  test('destroyOnRemoval enables delete + autoDeleteObjects', () => {
    const { template } = build({ destroyOnRemoval: true });
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Delete' });
    template.resourceCountIs('Custom::S3AutoDeleteObjects', 1);
  });
});

describe('distribution', () => {
  test('uses Origin Access Control (not OAI) for the S3 origin', () => {
    const { template } = build();
    template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
      OriginAccessControlConfig: Match.objectLike({
        OriginAccessControlOriginType: 's3',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      }),
    });
    template.resourceCountIs('AWS::CloudFront::CloudFrontOriginAccessIdentity', 0);
    const cfg = distributionConfig(template);
    expect(cfg.Origins).toHaveLength(1);
    expect(cfg.Origins[0].OriginAccessControlId).toBeDefined();
    // Bucket policy grants read to the CloudFront service principal for this distribution.
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:GetObject',
            Principal: { Service: 'cloudfront.amazonaws.com' },
          }),
        ]),
      },
    });
  });

  test('HTTP/2+3, price class 100, index.html root, no error-response SPA fallback', () => {
    const cfg = distributionConfig(build().template);
    expect(cfg.HttpVersion).toBe('http2and3');
    expect(cfg.PriceClass).toBe('PriceClass_100');
    expect(cfg.DefaultRootObject).toBe('index.html');
    expect(cfg.CustomErrorResponses).toBeUndefined();
  });

  test('viewer-request SPA rewrite function is associated with the default behaviour', () => {
    const { template } = build();
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: Match.objectLike({ Runtime: 'cloudfront-js-2.0' }),
      FunctionCode: SPA_REWRITE_FUNCTION_CODE,
    });
    const cfg = distributionConfig(template);
    expect(cfg.DefaultCacheBehavior.FunctionAssociations).toEqual([
      { EventType: 'viewer-request', FunctionARN: expect.anything() },
    ]);
  });

  test('default cache policy honours origin no-cache (MinTTL 0) and allows 1y', () => {
    const { template } = build();
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({ MinTTL: 0, MaxTTL: 31536000 }),
    });
  });

  test('no-cache behaviours exist for remoteEntry.js and friends with CachingDisabled', () => {
    const cfg = distributionConfig(build().template);
    const byPath = Object.fromEntries((cfg.CacheBehaviors as any[]).map((b) => [b.PathPattern, b]));
    for (const file of NO_CACHE_FILES) {
      expect(byPath[`/${file}`]).toBeDefined();
      expect(byPath[`/${file}`].CachePolicyId).toBe(CACHING_DISABLED_ID);
    }
    expect(byPath['/remoteEntry.js'].ViewerProtocolPolicy).toBe('redirect-to-https');
  });

  test('every behaviour carries the CORS/security response headers policy', () => {
    const cfg = distributionConfig(build().template);
    const expected = cfg.DefaultCacheBehavior.ResponseHeadersPolicyId;
    expect(expected).toBeDefined();
    for (const b of cfg.CacheBehaviors) {
      expect(b.ResponseHeadersPolicyId).toEqual(expected);
    }
  });
});

describe('response headers policy', () => {
  test('CORS for the other app origin + security headers', () => {
    const { template } = build();
    template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        CorsConfig: Match.objectLike({
          AccessControlAllowCredentials: false,
          AccessControlAllowHeaders: { Items: ['*'] },
          AccessControlAllowMethods: { Items: ['GET', 'HEAD', 'OPTIONS'] },
          AccessControlAllowOrigins: { Items: ['https://other.example.com'] },
          OriginOverride: true,
        }),
        SecurityHeadersConfig: Match.objectLike({
          StrictTransportSecurity: Match.objectLike({ IncludeSubdomains: true, Override: true }),
          ContentTypeOptions: { Override: true },
          FrameOptions: { FrameOption: 'SAMEORIGIN', Override: true },
          ReferrerPolicy: { ReferrerPolicy: 'strict-origin-when-cross-origin', Override: true },
        }),
      }),
    });
  });
});

describe('SPA rewrite function code', () => {
  const handler = new Function(`${SPA_REWRITE_FUNCTION_CODE}; return handler;`)() as (e: any) => any;
  const run = (uri: string) => handler({ request: { uri } }).uri;

  test.each([
    ['/', '/index.html'],
    ['/dashboard', '/index.html'],
    ['/customers/new', '/index.html'],
    ['/legacy/users/', '/index.html'],
  ])('rewrites %s', (uri, expected) => expect(run(uri)).toBe(expected));

  test.each(['/remoteEntry.js', '/assets/index-abc123.js', '/config.json', '/favicon.svg', '/mf-manifest.json'])(
    'passes through %s',
    (uri) => expect(run(uri)).toBe(uri),
  );
});

describe('deployments', () => {
  test('missing dist: no upload, warning annotation, synth still works', () => {
    const { stack, template } = build();
    expect(Object.keys(deployments(template))).toHaveLength(0);
    Annotations.fromStack(stack).hasWarning('/TestStack', Match.stringLikeRegexp('No build found'));
  });

  test('with dist: hashed assets immutable + no-cache files invalidated, both prune:false, ordered', () => {
    const { template } = build({ distPath: fixtureDist });
    const deps = deployments(template);
    const entries = Object.entries(deps);
    expect(entries).toHaveLength(2);

    const [hashedId, hashed] = entries.find(([, r]) => r.Properties.DestinationBucketKeyPrefix === 'assets/')!;
    const [, noCache] = entries.find(([id]) => id !== hashedId)!;

    expect(hashed.Properties.SystemMetadata).toEqual({ 'cache-control': IMMUTABLE_CACHE_CONTROL });
    expect(hashed.Properties.Prune).toBe(false);
    expect(hashed.Properties.DistributionPaths).toBeUndefined();

    expect(noCache.Properties.SystemMetadata).toEqual({ 'cache-control': NO_CACHE_CACHE_CONTROL });
    expect(noCache.Properties.Prune).toBe(false);
    expect(noCache.Properties.DistributionPaths).toEqual(
      expect.arrayContaining(['/index.html', '/remoteEntry.js', '/config.json', '/mf-manifest.json']),
    );
    expect(noCache.Properties.SourceObjectKeys).toHaveLength(1);
    expect(noCache.DependsOn).toEqual(expect.arrayContaining([hashedId]));
  });

  test('remotes context: config.json generated in the no-cache deployment', () => {
    const remotes = { app19: 'https://d111.cloudfront.net/remoteEntry.js' };
    const { template } = build({ distPath: fixtureDist, remotes });
    const noCache = Object.values(deployments(template)).find((r) => r.Properties.DestinationBucketKeyPrefix !== 'assets/')!;
    expect(noCache.Properties.SourceObjectKeys).toHaveLength(2);
  });

  test('remotes without dist: only config.json is deployed', () => {
    const { template } = build({ remotes: { app19: 'https://d111.cloudfront.net/remoteEntry.js' } });
    const deps = Object.values(deployments(template));
    expect(deps).toHaveLength(1);
    expect(deps[0].Properties.SourceObjectKeys).toHaveLength(1);
  });
});

describe('custom domain', () => {
  const domain = {
    domainName: 'portal.example.com',
    hostedZoneName: 'example.com',
    hostedZoneId: 'Z0000000000000',
    certificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate/abc',
  };

  test('off by default', () => {
    const { template } = build();
    template.resourceCountIs('AWS::Route53::RecordSet', 0);
    expect(distributionConfig(template).Aliases).toBeUndefined();
  });

  test('aliases, TLS1.2_2021 cert and A/AAAA alias records', () => {
    const { template } = build(domain);
    const cfg = distributionConfig(template);
    expect(cfg.Aliases).toEqual(['portal.example.com']);
    expect(cfg.ViewerCertificate).toMatchObject({
      AcmCertificateArn: domain.certificateArn,
      MinimumProtocolVersion: 'TLSv1.2_2021',
      SslSupportMethod: 'sni-only',
    });
    template.hasResourceProperties('AWS::Route53::RecordSet', { Type: 'A', Name: 'portal.example.com.' });
    template.hasResourceProperties('AWS::Route53::RecordSet', { Type: 'AAAA', Name: 'portal.example.com.' });
    template.hasOutput('RemoteEntryUrl', { Value: 'https://portal.example.com/remoteEntry.js' });
  });

  test('rejects non us-east-1 certificate and missing params', () => {
    expect(() => build({ ...domain, certificateArn: 'arn:aws:acm:eu-west-1:111111111111:certificate/abc' })).toThrow(
      /us-east-1/,
    );
    expect(() => build({ domainName: 'portal.example.com' })).toThrow(/requires context/);
  });
});

describe('outputs and tags', () => {
  test('outputs', () => {
    const { template } = build();
    for (const name of ['DistributionDomainName', 'BucketName', 'DistributionId', 'RemoteEntryUrl']) {
      template.hasOutput(name, {});
    }
  });

  test('tags app/repo/env', () => {
    const { template } = build();
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        { Key: 'app', Value: 'testapp' },
        { Key: 'env', Value: 'test' },
        { Key: 'repo', Value: 'test-repo' },
      ]),
    });
  });
});

describe('cdk-nag (AwsSolutions)', () => {
  test.each([
    ['no dist', {}],
    ['with dist', { distPath: '__fixture__' }],
    ['with dist + destroyOnRemoval + remotes', { distPath: '__fixture__', destroyOnRemoval: true, remotes: { a: 'https://x/remoteEntry.js' } }],
  ])('%s: all findings acknowledged', (_name, overrides: Partial<StaticMfeSiteStackProps>) => {
    const resolved = overrides.distPath === '__fixture__' ? { ...overrides, distPath: fixtureDist } : overrides;
    const { app } = build(resolved, { nag: true });
    expect(() => app.synth()).not.toThrow();
  });

  test('negative control: an unacknowledged finding fails synth', () => {
    const { app, stack } = build({}, { nag: true });
    new s3.Bucket(stack, 'UnloggedBucket');
    expect(() => app.synth()).toThrow();
  });
});

describe('context parsing (CLI strings vs cdk.json JSON)', () => {
  test('lists', () => {
    expect(contextStringList('["http://a","http://b"]', 'x')).toEqual(['http://a', 'http://b']);
    expect(contextStringList('http://a, http://b', 'x')).toEqual(['http://a', 'http://b']);
    expect(contextStringList(['http://a'], 'x')).toEqual(['http://a']);
    expect(contextStringList(undefined, 'x')).toBeUndefined();
  });

  test('maps', () => {
    expect(contextStringMap('{"app19":"https://d/remoteEntry.js"}', 'x')).toEqual({ app19: 'https://d/remoteEntry.js' });
    expect(contextStringMap({ app19: 'https://d/remoteEntry.js' }, 'x')).toEqual({ app19: 'https://d/remoteEntry.js' });
    expect(() => contextStringMap('{bad', 'x')).toThrow(/valid JSON/);
    expect(() => contextStringMap('["a"]', 'x')).toThrow(/JSON object/);
  });

  test('booleans', () => {
    expect(contextBool('true', false)).toBe(true);
    expect(contextBool(false, true)).toBe(false);
    expect(contextBool(undefined, true)).toBe(true);
    expect(() => contextBool('maybe', false)).toThrow();
  });
});

test('snapshot (no dist)', () => {
  expect(build().template.toJSON()).toMatchSnapshot();
});
