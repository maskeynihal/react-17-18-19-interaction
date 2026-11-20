# ADR 0003 — AWS hosting: S3 + CloudFront per app, CDK

Status: Accepted (2026-11-20)

## Decision
- Each repo owns `infra/` (CDK TypeScript) deploying its static build:
  private S3 bucket (OAC), CloudFront distribution, response headers policy
  with CORS (`Access-Control-Allow-Origin` = other app's origin) on **all**
  JS assets (dynamic ESM imports of chunks need CORS, not just remoteEntry).
- Cache: `index.html`, `remoteEntry.js`, `config.json`, `mf-manifest.json`
  → no-cache; `assets/*` hashed → 1 year immutable.
- SPA fallback via **CloudFront Function** that rewrites extensionless paths
  to `/index.html`. Not 403/404 → index.html error responses (a missing chunk
  would return HTML and produce a confusing MIME error).
- Optional: Route 53 + ACM for `portal.example.com` / `app.example.com`;
  WAF optional.
- Deployed with `cdk deploy` from CI after `npm run build`; BucketDeployment
  uploads `dist/` and invalidates `/index.html`, `/remoteEntry.js`,
  `/config.json`.

## Alternative
Single CloudFront with path behaviours (`/` → portal bucket, `/app19/*` →
app19 bucket): same origin, no CORS, but couples two repos to one
distribution. Documented in `docs/04-aws-infra.md` as option B.
