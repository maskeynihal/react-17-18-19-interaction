# React 17 ⇄ React 19 interaction

Two independent apps on different React majors that import each other's pages
and components — both directions — while each still runs standalone.

| App | Folder | React | Port | Exposes |
|---|---|---|---|---|
| Main portal (legacy) | [`react17-portal/`](react17-portal) | 17.0.2 | 5170 | `UsersPage`, `ProfileCard` |
| New app | [`react19-app/`](react19-app) | 19.3.1 | 5190 | `DashboardPage`, `CustomerFormPage`, `StatsWidget` |

Each folder is a self-contained project (own `package.json`, Playwright e2e,
AWS CDK `infra/`). They are kept in one repo for browsing; treat them as
separate repos (their histories were merged in with `git subtree`).

## How the apps share features

- **Mount adapters, not components.** Every shared feature exports
  `mount(el, props) → { update(props), unmount() }`. The React 17 side uses
  `ReactDOM.render`, the React 19 side `createRoot`. Hosts wrap them in a local
  `<RemoteMount>`, so two Reacts run side by side, each in its own root.
- **Data flow.** Props + `update()` go down, callback props come up, and
  `mfe:*` window `CustomEvent`s travel both ways. No React context, router or
  providers cross the boundary.
- **Bundled mode (default, [ADR 0004](docs/adr/0004-bundled-feature-packages.md)).**
  `npm run build:lib` packs each app's features as an npm package with its own
  React inside (`@mfe/app19-features`, `@mfe/portal17-features`). The other app
  installs it from a committed tarball in `vendor/` (`npm run sync:features`)
  and loads it with dynamic `import()`. No sibling server needed.
- **Remote mode (opt-in).** `"mode": "remote"` in `public/config.json` loads the
  sibling live via Module Federation (`@module-federation/vite`), see
  [ADR 0001](docs/adr/0001-module-federation-with-mount-adapters.md) and
  [ADR 0002](docs/adr/0002-remote-url-resolution.md).

## Run

```bash
cd react19-app && npm install && npm run dev      # http://localhost:5190
cd react17-portal && npm install && npm run dev   # http://localhost:5170
```

Either app works alone. After changing a shared feature, run
`npm run sync:features` in the *other* app.

## Test

```bash
cd react19-app && npx playwright install chromium && npm run test:e2e
cd react17-portal && npm run test:e2e
```

- Default run starts only the app under test and fails on any request to the
  sibling's port.
- `REMOTE=1 npm run test:e2e` also starts the sibling and runs remote-mode tests.
- `npm run test:e2e:watch` runs headed Chrome in slow motion (`SLOWMO=700`).

## AWS hosting

Each app has `infra/` (CDK, TypeScript): private S3 bucket + CloudFront (OAC),
SPA rewrite via CloudFront Function, CORS + security headers, no-cache for
`index.html` / `remoteEntry.js` / `config.json`, immutable hashed assets.
Diagram, options and costs: [docs/04-aws-infra.md](docs/04-aws-infra.md).
Not deployed; `cdk synth` and tests only.

## Docs

- [Brief and acceptance criteria](docs/01-brief.md)
- [Integration contract](docs/02-contract.md)
- [ADRs](docs/adr)
- [QA round 1 findings](docs/qa/round1-findings.md) (open items)
