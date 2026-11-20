# react17-portal — Main Portal (React 17.0.2)

The legacy enterprise portal. It is both:

- **host** — embeds React 19 pages/widgets from `app19` (`../react19-app`), and
- **remote** (`portal17`) — exposes React 17 `UsersPage` and `ProfileCard` to `app19`, both via Module
  Federation and as the npm package `@mfe/portal17-features`.

It runs **standalone** (ADR 0004, `docs/adr/0004-bundled-feature-packages.md`): by default the app19 features
come from `@mfe/app19-features` (React 19 bundled inside, vendored as `vendor/*.tgz`), so app19's server is
never needed. Runtime federation against a running app19 is opt-in via `"mode": "remote"` in `config.json`.

Integration rules, names, ports, types and routes live in
[`../docs/02-contract.md`](../docs/02-contract.md) (source of truth) and ADRs in `../docs/adr/`.
`src/mfe/contract.ts` is a verbatim copy of contract §3 — change the doc first, then both repos.

## Stack (pinned, contract §1)

React / react-dom 17.0.2 (legacy `ReactDOM.render`, no `createRoot`), react-router-dom 6.30.6,
Vite 8.3.8, @vitejs/plugin-react 6.3.0, @module-federation/vite 1.24.1 (+ its runtime
`@module-federation/runtime` 2.9.3), TypeScript 5.9.3 (strict), @playwright/test 1.65.1, Node 24.

## Scripts

| script | what |
|---|---|
| `npm run dev` | Vite dev server on **5170** (strictPort) |
| `npm run build` | `tsc -b && vite build` → `dist/` (`dist/remoteEntry.js` at the root) |
| `npm run preview` | serve `dist/` on **5170** (strictPort) |
| `npm run typecheck` | `tsc -b` |
| `npm run test:e2e` | Playwright, bundled mode, portal only (`REMOTE=1` adds remote-mode tests + app19) |
| `npm run test:e2e:watch` | headed, 1 worker, `SLOWMO` (default 700 ms) |
| `npm run build:lib` | library build of `src/exposed/*` → `lib-dist/` (`@mfe/portal17-features`) |
| `npm run pack:lib` | `build:lib` + `npm pack` → `lib-pack/mfe-portal17-features-<ver>.tgz` |
| `npm run sync:features` | rebuild + pack app19's `@mfe/app19-features`, copy to `vendor/`, `npm install` |

## Federation

| | |
|---|---|
| name | `portal17` |
| remoteEntry | `http://localhost:5170/remoteEntry.js` |
| exposes | `./UsersPage` → `src/exposed/UsersPage.tsx`, `./ProfileCard` → `src/exposed/ProfileCard.tsx` |
| remotes | none static; `app19` registered at runtime in `"mode": "remote"` only |
| shared | `{}` — React is never shared across majors |

Exposed modules export a mount adapter (`mount(el, props) → { update, unmount }`) implemented with
`ReactDOM.render` / `ReactDOM.unmountComponentAtNode`. Their root element carries
`data-mfe`, `data-react-version` and `data-theme`. All CSS is `.r17-*` scoped.

Test ids a host can rely on: `users-search`, `users-table`, `user-row` (+ `data-user-id`,
`aria-selected`), `users-empty`, `profile-card` (+ `data-user-id`), `profile-card-name`.

### Feature modes (ADR 0004)

`src/main.tsx` awaits `applyRuntimeRemoteConfig()` (`src/mfe/runtime.ts`) before rendering. It fetches
`/config.json` (shipped: `{ "mode": "bundled", "remotes": { "app19": "http://localhost:5190/remoteEntry.js" } }`)
and exposes the resolved mode as `<html data-feature-mode>`.

| `mode` | How `RemoteMount remote="app19/DashboardPage"` loads | Needs app19 running? |
|---|---|---|
| `bundled` (default; also when `config.json` is 404 / `{}` / invalid / has no `mode`) | loader map → `import('@mfe/app19-features/DashboardPage')`, a code-split chunk served from this origin | **no** |
| `remote` | `registerRemotes([{ name: 'app19', entry, … }], { force: true })` then `loadRemote('app19/DashboardPage')` | yes |

In remote mode, entry = `remotes.app19` if present, otherwise the build-time default (`VITE_REMOTE_APP19`, else
`http://localhost:5190/remoteEntry.js`). There is **no static `remotes` block** in `vite.config.ts`, so the
federation plugin never preloads or eagerly fetches app19's `remoteEntry.js`: in bundled mode no request ever
goes to port 5190 (asserted by e2e). `@module-federation/runtime` is pinned to the exact version the Vite plugin
depends on, so the build has one runtime chunk and `registerRemotes`/`loadRemote` act on the `portal17`
instance the plugin's `hostInit` created (the exposes still need it). `shareStrategy: 'loaded-first'`: nothing
is shared; a remote entry is fetched only on first load.

### Feature package `@mfe/portal17-features` (what app19 embeds)

`npm run build:lib` (`vite.lib.config.ts` + `scripts/build-lib.mjs`) builds `src/exposed/*` in Vite library mode
into `lib-dist/` (gitignored): ESM entries `./UsersPage`, `./ProfileCard` (each exports `mount` + `default`),
**React 17 + react-dom bundled** (not external), `process.env.NODE_ENV` = `"production"`, `.r17-*` CSS injected by
the module on first import (`<style id="mfe-portal17-features-css">`), types `contract.d.ts` +
`<Entry>/index.d.ts`, and a generated `lib-dist/package.json` (this repo's `package.json` stays private).
`npm run pack:lib` packs it into `lib-pack/`; app19 pulls it with its own `npm run sync:features`.

### Consuming `@mfe/app19-features`

`vendor/mfe-app19-features-<ver>.tgz` is committed and referenced as
`"@mfe/app19-features": "file:vendor/…tgz"`. To pick up app19 changes:

```bash
npm run sync:features                                  # sibling at ../react19-app
SIBLING_DIR=/path/to/react19-app npm run sync:features
```

It runs `npm run pack:lib` in the sibling, replaces the tarball in `vendor/` and reinstalls it (commit `vendor/`
and `package-lock.json`). Moving to a private registry later needs no code change.

## Routes (contract §6)

| path | content |
|---|---|
| `/` | Home; two `app19/StatsWidget`s (customers, revenue) + "Bump revenue" button (props → `update()`) |
| `/users` | own R17 UsersPage + ProfileCard of the selected user |
| `/profile` | own R17 ProfileForm (legacy class component, validation) |
| `/dashboard` | `app19/DashboardPage` with the host's customers |
| `/customers/new` | `app19/CustomerFormPage`; `onSubmit` adds to the host store, shows toast, navigates to `/dashboard` |

The customer store is host-owned (React 17 context, in-memory, 6 seeded). Only the plain
`customers` array crosses the boundary. The host also listens to `mfe:customer-created` and
`mfe:navigate`; adds are deduped by id (onSubmit and the event both arrive for one submit).

`RemoteMount` (`src/host/RemoteMount.tsx`) caches one load promise (bundled import or `loadRemote`) per remote id (evicted on
failure so **Retry** re-fetches), mounts into `<div data-remote="…">`, calls `update(props)` on
props change and defers `unmount()` with `setTimeout(0)`. Loading → `data-testid="remote-loading"`;
failure → `role="alert" data-testid="remote-error"` with `remote-retry`.

## Running

Standalone (default — app19 not needed):

```bash
npm run dev            # or: npm run build && npm run preview   → http://localhost:5170
```

Remote mode against a live app19: set `"mode": "remote"` in `public/config.json` (or `dist/config.json`), and

```bash
# terminal 1 (sibling repo)
cd ../react19-app && npm run build && npm run preview   # :5190
# terminal 2
npm run build && npm run preview                         # :5170
```

### Dev HMR limitation (contract §7)

Each app's own HMR works under `npm run dev`. Editing the **other** app does not hot-update inside
this host (two React Refresh runtimes). Run the other app as `build && preview` while developing
here. A preview/prod host cannot consume a dev-server remote (refresh preamble error) — e2e always
uses preview builds.

## E2E (Playwright)

```bash
npx playwright install chromium   # once
npm run test:e2e                  # default: bundled mode, starts ONLY the portal (5170)
REMOTE=1 npm run test:e2e         # + "remote" project: also starts app19 (SIBLING_DIR, default ../react19-app)
npm run test:e2e:watch            # headed + SLOWMO
```

- Default: one project, `bundled`; `webServer` builds and previews only this repo on 5170. Every `@cross` test
  runs against the bundled `@mfe/app19-features`. The auto fixture `siblingRequests` records every request of
  the browser context and **fails the test if any went to port 5190**.
- `REMOTE=1`: adds app19's `webServer` (5190) and the `remote` project, which routes `config.json` to
  `"mode": "remote"` and runs `@cross` + `@remote` tests (the sibling-port check is off there).
- Servers are reused when not in CI. A fixture also fails any test that logs a console `error` or throws a
  `pageerror` (per-test allowlist via `test.use({ allowedConsoleErrors })`).

Specs:

- `e2e/bundled.spec.ts` — Home / `/dashboard` / `/customers/new` render React 19 features in the React 17 shell
  with zero requests to 5190 and only same-origin scripts; package CSS injected; config.json 404 / `{}` /
  invalid JSON → bundled.
- `e2e/standalone.spec.ts` — shell version, users search/select + `mfe:user-selected`, profile form
  validation, config.json, remoteEntry exposes, exposed mount adapters (mount/update/unmount).
- `e2e/cross.spec.ts` — `@cross` (both modes): `/dashboard` R19 inside R17 shell + host customer KPI + theme
  update; `/customers/new` validation → submit → toast, count +1, redirect, row in table; Home widgets + bump
  (`update()` on the same root); navigate-away unmount; click bubbling from the R19 remote to an R17 host
  ancestor's `onClick` (documented ADR 0001 behaviour, asserted). Bundled only: aborting the `DashboardPage`
  package chunk → `remote-error`, shell keeps working, Retry re-imports it. `@remote` (remote mode only): `route.abort` of
  app19 `remoteEntry.js` → `remote-error`, shell/nav keep working, Retry recovers; config.json URL override wins;
  remote mode without `remotes` uses the build-time default.

`infra/` (CDK, ADR 0003) is a separate project with its own README; it is excluded from
`tsconfig`, Vite's dep scan/watch, and Playwright.
