# react19-app — New App (React 19)

The new app in the React 17 ⇄ React 19 interop demo. It is both:

- a **standalone app** (React 19.3.1, react-router 7) with a customer dashboard, a customer form built with
  React 19 actions, and a `/legacy/users` page; and
- a **Module Federation remote** named `app19` that exposes framework-agnostic mount adapters the React 17
  portal (`react17-portal`, separate repo) embeds; and
- a **host** that embeds the portal's React 17 `UsersPage` and `ProfileCard`.

It runs **standalone** (ADR 0004): by default the portal features come from the npm package
`@mfe/portal17-features` (React 17 bundled inside, vendored as `vendor/*.tgz`), so the portal server is never
needed. Runtime Module Federation against a running portal is still available as opt-in `"mode": "remote"`.
Nothing React-related is shared between the apps: each bundles its own React (ADR 0001).

## Contract

The integration contract lives in the docs repo: `docs/02-contract.md` (versions, names, ports, exposes, types,
routes, rules) and `docs/adr/*`. Its TypeScript is copied **verbatim** into [`src/mfe/contract.ts`](src/mfe/contract.ts).
Change the contract doc first, then both repos.

| | |
|---|---|
| Federation name | `app19` |
| Port (dev + preview, strictPort) | **5190** |
| Remote entry | `http://localhost:5190/remoteEntry.js` |
| Feature package (published) | `@mfe/app19-features` (`npm run build:lib` → `lib-dist/`) |
| Consumes (default, `bundled`) | `@mfe/portal17-features` ← `file:vendor/mfe-portal17-features-0.1.0.tgz` |
| Consumes (opt-in, `remote`) | `portal17` → `http://localhost:5170/remoteEntry.js` |

Exposes (each exports `mount` and `default`, `mount(el, props) → { update, unmount }`, using `createRoot`):

| Expose | File | Props | Root element |
|---|---|---|---|
| `./DashboardPage` | `src/exposed/DashboardPage.tsx` | `DashboardPageProps` | `[data-mfe=DashboardPage][data-react-version][data-theme]` |
| `./CustomerFormPage` | `src/exposed/CustomerFormPage.tsx` | `CustomerFormPageProps` | `[data-mfe=CustomerFormPage]…` |
| `./StatsWidget` | `src/exposed/StatsWidget.tsx` | `StatsWidgetProps` | `[data-mfe=StatsWidget]…` |

Routes: `/` dashboard (+ portal17 `ProfileCard`), `/customers/new` form, `/legacy/users` portal17 `UsersPage`
with a selected-user banner (`data-testid="selected-user"`).

All CSS is scoped under `.r19-*` classes; theme variables live on `.r19-root[data-theme]`, never on `:root`.

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Vite dev server on 5190 |
| `npm run build` | `tsc -b && vite build` → `dist/` (incl. `dist/remoteEntry.js`) |
| `npm run preview` | Serve `dist/` on 5190 (strictPort) |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm run test:e2e` | Playwright, bundled mode, this app only (`REMOTE=1` adds remote-mode tests + the portal) |
| `npm run test:e2e:watch` | Headed, 1 worker, `SLOWMO` (default 700 ms) |
| `npm run build:lib` | Library build of `src/exposed/*` → `lib-dist/` (`@mfe/app19-features`, see below) |
| `npm run pack:lib` | `build:lib` + `npm pack` → `lib-pack/mfe-app19-features-<ver>.tgz` |
| `npm run sync:features` | Rebuild + pack the portal's `@mfe/portal17-features`, copy to `vendor/`, `npm install` |

Node 24. Versions are pinned exactly per contract §1.

## Feature modes (ADR 0004)

`public/config.json` (fetched at boot by `src/mfe/remotes.ts`, serve it `no-cache`):

```json
{ "mode": "bundled", "remotes": { "portal17": "http://localhost:5170/remoteEntry.js" } }
```

| `mode` | How `RemoteMount remote="portal17/UsersPage"` loads | Needs the portal running? |
|---|---|---|
| `bundled` (default; also when `config.json` is missing/invalid or has no `mode`) | loader map → `import('@mfe/portal17-features/UsersPage')`, a code-split chunk served from this origin | **no** |
| `remote` | runtime Module Federation: `registerRemotes` from `remotes` (else build-time default) → `loadRemote('portal17/UsersPage')` | yes |

The resolved mode is exposed as `<html data-feature-mode>`. Static `remotes` are not configured in the
federation plugin, so in bundled mode nothing (no modulepreload, no eager fetch) ever touches port 5170.

### Feature package `@mfe/app19-features` (what the portal embeds)

`npm run build:lib` (`vite.lib.config.ts` + `scripts/build-lib.mjs`) builds the exposed adapters in Vite library
mode into `lib-dist/` (gitignored):

- ESM entries `./DashboardPage`, `./CustomerFormPage`, `./StatsWidget` — each exports `mount` and `default`
  (contract `mount(el, props) → { update, unmount }`); shared code (incl. React) in `chunks/`.
- **React 19 + react-dom bundled** (not external, no peer deps); `process.env.NODE_ENV` = `"production"`.
- CSS (`.r19-*` scoped) is injected by the module itself on first import (`<style id="mfe-app19-features-css">`).
- Types: `contract.d.ts` + `<Entry>/index.d.ts`; a generated `lib-dist/package.json` (this repo's
  `package.json` stays private).

`npm run pack:lib` packs it into `lib-pack/`. The portal pulls it with its own `npm run sync:features`.

### Consuming `@mfe/portal17-features`

`vendor/mfe-portal17-features-<ver>.tgz` is committed and referenced as
`"@mfe/portal17-features": "file:vendor/…tgz"`. To pick up portal changes:

```sh
npm run sync:features                                  # sibling at ../react17-portal
SIBLING_DIR=/path/to/react17-portal npm run sync:features
```

It runs `npm run pack:lib` in the sibling, replaces the tarball in `vendor/` and reinstalls it (commit
`vendor/` + `package-lock.json`). Later the package can move to a private registry without code changes.

### Remote mode (runtime federation, ADR 0002)

With `"mode": "remote"`, `remotes.portal17` (else `VITE_REMOTE_PORTAL17`, else
`http://localhost:5170/remoteEntry.js`) is registered via `registerRemotes(..., { force: true })` before the
first `loadRemote`. To point the same build elsewhere, only replace `config.json`.

- `registerRemotes`/`loadRemote`/`getInstance`/`init` are imported from `@module-federation/runtime@2.9.3` — the
  exact package the `@module-federation/vite` plugin's generated init code imports, so the bundle contains a
  single runtime copy.
- `shareStrategy: 'loaded-first'`: nothing is shared; a remote's `remoteEntry.js` is fetched only on first load.

## Running

Standalone (default — no portal needed):

```sh
npm run dev        # or: npm run build && npm run preview   → http://localhost:5190
```

Remote mode against a live portal: set `"mode": "remote"` in `public/config.json` (or `dist/config.json`), and

```sh
# terminal 1 — portal (preview build; a preview host can't consume a dev-server remote)
cd ../react17-portal && npm run build && npm run preview
# terminal 2 — this app
npm run build && npm run preview
```

In remote mode, if the portal is down the ProfileCard / UsersPage areas show a `role="alert"` fallback with a
Retry button; the rest of the app keeps working.

### Dev-mode HMR limitation (contract §7)

Each app's own HMR works under `npm run dev`. Editing the *other* app does not hot-update inside this host (two
React Refresh runtimes). Run the other app as `npm run build && npm run preview` and reload. A preview/prod
host cannot consume a dev-server remote (React Refresh preamble error), so e2e always uses preview builds.

## E2E (Playwright)

```sh
npx playwright install chromium   # once
npm run test:e2e                  # default: bundled mode, starts ONLY this app (5190)
REMOTE=1 npm run test:e2e         # + "remote" project: also starts the portal (SIBLING_DIR, default ../react17-portal)
npm run test:e2e:watch            # headed + SLOWMO
```

- Default: one project, `bundled`. `webServer` builds and previews only this app; every `@cross` test runs
  against the bundled `@mfe/portal17-features`. The auto fixture `siblingRequests` records every request of the
  browser context and **fails the test if any went to port 5170**.
- `REMOTE=1`: adds the portal `webServer` (5170) and the `remote` project, which routes `config.json` to
  `"mode": "remote"` and runs `@cross` + `@remote` tests (the sibling-port check is off there). Existing servers
  are reused unless `CI` is set.
- `e2e/fixtures.ts` also fails any test that logs a console `error` or a `pageerror` (catches duplicate-React /
  invalid-hook / unmount-race errors). Tests that deliberately break the network allow only that exact message.
- `e2e/bundled.spec.ts` — all embed routes render React 17 features inside the React 19 shell with zero requests
  to 5170 and only same-origin scripts; package CSS injected; missing/invalid `config.json` → bundled.
- `e2e/standalone.spec.ts` — KPIs, validation errors, successful submit → event + dashboard update, ProfileCard
  still renders with the portal origin blocked.
- `e2e/cross.spec.ts` — `@cross` (both modes): `/legacy/users` renders `[data-mfe=UsersPage]` on React 17.0.2
  inside a React 19 shell; selecting a user → callback + `mfe:user-selected` + banner; ProfileCard on the
  dashboard is 17.0.2; theme propagates via `update()`; navigating away removes the remote DOM; clicks inside
  the React 17 remote **bubble to the React 19 host's `onClick`** (ADR 0001). Bundled only: aborting the
  `ProfileCard` package chunk shows `remote-error`, Retry re-imports it. `@remote` (remote mode only):
  aborting the portal `remoteEntry.js` shows `remote-error` and Retry recovers; `config.json` URL override.

## Layout

```
src/
  main.tsx, App.tsx          standalone shell bootstrap + routes
  shell/                     header/nav (data-app-shell, data-react-version)
  pages/                     standalone routes wrapping the inner components
  features/                  router-free Dashboard, CustomerForm, StatsCard, MfeRoot
  exposed/                   mount adapters (createRoot) for federation + the @mfe/app19-features package
  mfe/contract.ts            verbatim contract
  mfe/remotes.ts             config.json → mode; bundled loader map / registerRemotes + loadRemote (cached)
  mfe/RemoteMount.tsx        host wrapper: loading / error+retry / update / deferred unmount
  store/customerStore.ts     in-memory customers (seeded) + current user
e2e/                         Playwright specs + console-error / sibling-port fixtures
vite.lib.config.ts           library build (React bundled, CSS injected); scripts/build-lib.mjs adds .d.ts + package.json
scripts/sync-features.mjs    pack the sibling's feature package into vendor/ and install it
vendor/                      committed @mfe/portal17-features tarball
infra/                       CDK (separate package, excluded from app tsconfig/vite)
```
