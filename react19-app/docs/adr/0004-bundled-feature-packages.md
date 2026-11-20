# ADR 0004 — Bundled feature packages (default), runtime federation (opt-in)

Status: Accepted (2026-11-20). Extends ADR 0001; mount contract unchanged.

## Context
User requirement: React 17 portal and React 19 app must each run **standalone**.
Neither may need the other app's server running to render the other's
features. Runtime Module Federation (ADR 0001/0002) requires the sibling to be
deployed and reachable.

## Decision
- Each repo publishes its exposed features as an npm package built in Vite
  library mode with **its own React bundled in** (react/react-dom NOT
  external; `process.env.NODE_ENV` defined `production`):
  - react19-app → `@mfe/app19-features` (exports `./DashboardPage`,
    `./CustomerFormPage`, `./StatsWidget`)
  - react17-portal → `@mfe/portal17-features` (exports `./UsersPage`,
    `./ProfileCard`)
  Each export is the same `mount(el, props) → { update, unmount }` adapter.
  CSS is injected by the module (or shipped as `./style.css` imported by the
  entry) and stays `.r17-*` / `.r19-*` scoped. Types: `contract.d.ts`.
- Distribution (no registry yet): `npm run build:lib && npm pack` produces a
  tarball; consumer commits it to `vendor/` and depends on
  `"file:vendor/<name>-<ver>.tgz"`. `npm run sync:features` in the consumer
  rebuilds + packs the sibling (`SIBLING_DIR`, default `../<sibling>`), copies
  the tarball, reinstalls. Later: swap to a private registry (CodeArtifact /
  GitHub Packages) without code change.
- Host `RemoteMount` loads via a loader map: default mode `bundled` uses
  `import('@mfe/<pkg>/<Expose>')` (code-split chunk). Runtime federation kept
  as opt-in `"mode": "remote"` in `config.json` (ADR 0002 rules apply).
- E2E default starts only the app under test and asserts **zero requests** to
  the sibling's port. `REMOTE=1` runs the remote-mode suite with both servers.

## Consequences
+ Each app deploys and runs alone; no cross-origin CORS needed in default mode.
+ Version pinned at build time: reproducible, testable offline.
− Updating a feature requires the consumer to re-sync and redeploy (trade-off
  vs runtime federation's live updates; keep remote mode for that).
− Two Reacts still on the page when embedding (unchanged).
