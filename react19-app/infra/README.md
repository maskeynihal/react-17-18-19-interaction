# react19-app / infra

AWS CDK (TypeScript) for hosting the `app19` micro-frontend
(Module Federation host **and** remote) as a static site:
private S3 bucket → CloudFront (OAC) → browser. See
[ADR 0003](../../docs/adr/0003-aws-hosting.md) and
[docs/04-aws-infra.md](../../docs/04-aws-infra.md).

This folder is its **own npm package** (own `package.json`, `node_modules`,
`tsconfig.json`, `cdk.json`). It does not touch the app's dependencies.
It deploys the app build output from `../dist`.

> Nothing in this repo has been deployed. Commands below are for operators/CI.

## What gets created (`App19WebStack`)

| Resource | Notes |
|---|---|
| S3 bucket | Block all public access, SSE-S3, `enforceSSL`, `RETAIN` by default. Only CloudFront can read (OAC bucket policy). |
| CloudFront distribution | `S3BucketOrigin.withOriginAccessControl`, HTTP/2+3, price class 100, `index.html` default root, HTTPS redirect, compression. TLSv1.2_2021 when a custom domain/cert is set. |
| CloudFront Function (viewer-request) | Rewrites extensionless paths (no `.` in the last segment) to `/index.html`. **No** 403/404 → index.html error responses, so a missing chunk is a real 404 and not HTML with a JS MIME error. |
| Response headers policy | CORS (`allowedOrigins`, GET/HEAD/OPTIONS, headers `*`, `originOverride`) on **every** behaviour (dynamic chunk imports need CORS too) + HSTS, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`. CSP deliberately left out (see comment in `lib/static-mfe-site-stack.ts`: `script-src` must include the other app's origin). |
| Cache policies / behaviours | Default: honours origin `Cache-Control` (MinTTL 0, max 1 year) – hashed `assets/*` are uploaded `public,max-age=31536000,immutable`. `/index.html`, `/remoteEntry.js`, `/config.json`, `/mf-manifest.json`: own behaviours with `CachingDisabled`. |
| BucketDeployment ×2 | (1) `dist/assets/**` → `assets/` with immutable cache-control, `prune: false` (old chunks stay for sessions still running the previous `remoteEntry.js`). (2) everything else in `dist/` with `no-cache`, `prune: false`, invalidates `/`, `/index.html`, `/remoteEntry.js`, `/config.json`, `/mf-manifest.json`. (2) depends on (1) so a new `remoteEntry.js` never goes live before its chunks. |
| `config.json` (optional) | When `remotes` is set, `dist/config.json` is replaced by a generated one (`{"remotes": {...}}`) inside deployment (2). |
| Route 53 + ACM (optional) | Alias A/AAAA records + existing us-east-1 certificate. Off by default. |
| cdk-nag | `AwsSolutionsChecks` runs on every synth; unacknowledged findings fail synth. Acknowledgements with reasons are in `addNagSuppressions()`. Disable with `-c nag=false`. |

Outputs: `DistributionDomainName`, `DistributionId`, `BucketName`, `RemoteEntryUrl`.
Tags: `app=app19`, `repo=react19-app`, `env=<envName>`.

### Why the default behaviour's MinTTL is 0
A deep link such as `/dashboard` selects the **default** behaviour first; the
viewer-request function then rewrites it to `/index.html`. The response is
therefore cached under the default policy, so that policy must let the
object's own `Cache-Control: no-cache` win (MinTTL 0). Hashed assets still
get one year because their object metadata says so.

## Context

Pass with `-c key=value` (strings; JSON accepted for lists/maps) or put in `cdk.json` → `context`.

| Key | Default | Meaning |
|---|---|---|
| `distPath` | `../dist` | Build output, relative to `infra/` or absolute. |
| `envName` | `dev` | Tag value + distribution comment. |
| `allowedOrigins` | `["http://localhost:5170","http://localhost:5190"]` | Origins allowed by CORS. In AWS set it to the **other** app's origin, e.g. `'["https://portal.example.com"]'`. JSON array or comma list. |
| `remotes` | – | JSON object written to `/config.json`, e.g. `'{"portal17":"https://dxxxx.cloudfront.net/remoteEntry.js"}'`. If absent, `dist/config.json` (if any) is uploaded as is. |
| `destroyOnRemoval` | `false` | `true` = bucket `DESTROY` + `autoDeleteObjects` (dev only). |
| `domainName` | – | e.g. `app.example.com`. Requires the three keys below. |
| `hostedZoneName` | – | e.g. `example.com`. |
| `hostedZoneId` | – | Route 53 zone ID (used instead of a lookup so synth needs no credentials). |
| `certificateArn` | – | ACM certificate **in us-east-1** covering `domainName`. Synth fails if the ARN is not us-east-1. |
| `nag` | `true` | Run cdk-nag AwsSolutions checks. |

**Custom domain choice:** `DnsValidatedCertificate` is deprecated, and a second
us-east-1 certificate stack with `crossRegionReferences` adds a stack, SSM
exports and ordering. The simpler option was chosen: create/validate the
certificate once (console or a tiny separate stack in us-east-1) and pass
`certificateArn`.

### Missing `dist/`
Synth never needs a build. If `<distPath>/index.html` is missing, both
BucketDeployments are skipped and synth prints the warning
`mfe-infra:distMissing` (the infra is still created; nothing is uploaded).
If `remotes` is set without a build, only `config.json` is uploaded. If
`dist/assets/` is missing but `index.html` exists, only root files are
uploaded (`mfe-infra:assetsMissing`). Always `npm run build` in the app before
`cdk deploy`.

## Commands (not run by the authors – no deploy has been performed)

```bash
cd infra
npm ci
npm run typecheck          # tsc --noEmit
npm test                   # jest: assertions + nag + snapshot
npx cdk synth              # no AWS credentials needed (env-agnostic stack)
npx cdk synth -c distPath=/abs/path/to/dist

# one-time per account/region (operator)
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>

# deploy (after building the app: cd .. && npm ci && npm run build)
npx cdk deploy App19WebStack -c envName=dev \
  -c 'allowedOrigins=["https://<other-app-cloudfront-domain>"]' \
  -c 'remotes={"portal17":"https://<other-app-cloudfront-domain>/remoteEntry.js"}'

npx cdk diff App19WebStack ...
```

Update the snapshot after an intentional change: `npx jest -u`.

## Deploy order (two repos, each needs the other's URL)

1. Deploy **both** stacks (`Portal17WebStack` from `react17-portal/infra`,
   `App19WebStack` from `react19-app/infra`) without `remotes`. Note each
   stack's `DistributionDomainName` / `RemoteEntryUrl` outputs.
2. Redeploy each stack with:
   - `allowedOrigins` = the other app's `https://<domain>` origin,
   - `remotes` = `{"<other federation name>": "<other RemoteEntryUrl>"}`.
   Only `config.json` and the response headers policy change; the app build is
   the same artifact (ADR 0002).
3. With custom domains the URLs are known in advance, so a single pass with all
   context values works.

Store the per-environment values as GitHub environment variables (see below)
so CI passes them on every deploy.

## CI/CD

`github-actions-deploy.example.yml` is an example workflow (copy to
`.github/workflows/deploy.yml` in this repo). It uses GitHub OIDC to assume an
IAM role (`aws-actions/configure-aws-credentials`) – no static keys. The role
needs permission to assume the CDK bootstrap roles
(`cdk-hnb659fds-*-<account>-<region>`), and its trust policy should be limited
to this repo + branch/environment (`token.actions.githubusercontent.com:sub`).
