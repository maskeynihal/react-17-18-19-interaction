# react17-portal — Main Portal (React 17.0.2)

The legacy enterprise portal. It is both:

- **host** — embeds React 19 pages/widgets from `app19` (`../react19-app`) at runtime, and
- **remote** (`portal17`) — exposes React 17 `UsersPage` and `ProfileCard` to `app19`.

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
| `npm run test:e2e` | Playwright (see below) |

## Federation

| | |
|---|---|
| name | `portal17` |
| remoteEntry | `http://localhost:5170/remoteEntry.js` |
| exposes | `./UsersPage` → `src/exposed/UsersPage.tsx`, `./ProfileCard` → `src/exposed/ProfileCard.tsx` |
| remotes | `app19` (type `module`) |
| shared | `{}` — React is never shared across majors |

Exposed modules export a mount adapter (`mount(el, props) → { update, unmount }`) implemented with
`ReactDOM.render` / `ReactDOM.unmountComponentAtNode`. Their root element carries
`data-mfe`, `data-react-version` and `data-theme`. All CSS is `.r17-*` scoped.

Test ids a host can rely on: `users-search`, `users-table`, `user-row` (+ `data-user-id`,
`aria-selected`), `users-empty`, `profile-card` (+ `data-user-id`), `profile-card-name`.

### Remote URL resolution (ADR 0002)

`src/main.tsx` awaits `applyRuntimeRemoteConfig()` (`src/mfe/runtime.ts`) before rendering:

1. fetch `/config.json` → `{ "remotes": { "app19": "<url>/remoteEntry.js" } }`;
2. entry = that URL if valid, otherwise the build-time default (`VITE_REMOTE_APP19`, else
   `http://localhost:5190/remoteEntry.js`);
3. **always** `registerRemotes([{ name: 'app19', entry, … }], { force: true })` from
   `@module-federation/runtime`.

Registration is unconditional because @module-federation/vite 1.24.1 registers the static
`remotes` entry under an internal alias (`__mfe_internal__portal17__mf_owner__…__app19`), so
`loadRemote('app19/…')` fails with RUNTIME-004 unless `app19` is registered at runtime. The static
`remotes` block in `vite.config.ts` is kept (contract §2) but is not what `loadRemote` uses.
E2E covers: override wins (no request to :5190), and 404 / `{}` / invalid JSON fall back to default.

`public/config.json` ships the localhost URL. In each environment only `config.json` changes.
`@module-federation/runtime` is pinned to the exact version the Vite plugin depends on, so npm
dedupes it and the build contains one runtime chunk — `registerRemotes`/`loadRemote` act on the
same `portal17` instance the plugin's `hostInit` created (`window.__FEDERATION__.__INSTANCES__`
contains `portal17` exactly once).

`shareStrategy: 'loaded-first'` is set so the plugin does **not** preload the build-time
`app19` remoteEntry from `index.html`/bootstrap. With the default strategy it injects a
`<link rel=modulepreload>` and an eager `import()` of the static URL — which would hit
`localhost:5190` in production even when `config.json` points elsewhere, and logs a console
error on every page when app19 is down. Nothing is shared, so the strategy has no other effect.

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

`RemoteMount` (`src/host/RemoteMount.tsx`) caches one `loadRemote` promise per remote id (evicted on
failure so **Retry** re-fetches), mounts into `<div data-remote="…">`, calls `update(props)` on
props change and defers `unmount()` with `setTimeout(0)`. Loading → `data-testid="remote-loading"`;
failure → `role="alert" data-testid="remote-error"` with `remote-retry`.

## Running with app19

```bash
# terminal 1 (sibling repo)
cd ../react19-app && npm run build && npm run preview   # :5190
# terminal 2
npm run build && npm run preview                         # :5170  (or npm run dev)
```

### Dev HMR limitation (contract §7)

Each app's own HMR works under `npm run dev`. Editing the **other** app does not hot-update inside
this host (two React Refresh runtimes). Run the other app as `build && preview` while developing
here. A preview/prod host cannot consume a dev-server remote (refresh preamble error) — e2e always
uses preview builds.

## E2E (Playwright)

`playwright.config.ts` (`testDir: e2e`) starts two web servers:

- this repo: `npm run build && npm run preview` on 5170;
- the sibling: `npm run build && npm run preview` in `${APP19_DIR ?? '../react19-app'}` on 5190.

Both use `reuseExistingServer` when not in CI. A fixture (`e2e/fixtures.ts`) fails any test that
logs a console `error` or throws a `pageerror` (per-test allowlist via `test.use({ allowedConsoleErrors })`).

```bash
npx playwright install chromium                 # once
npm run test:e2e                                # everything (needs ../react19-app)
APP19=0 npm run test:e2e -- --grep-invert @cross   # portal only, sibling not started
APP19_DIR=/path/to/react19-app npm run test:e2e
```

Specs:

- `e2e/standalone.spec.ts` — shell version, users search/select + `mfe:user-selected`, profile form
  validation, config.json, remoteEntry exposes, exposed mount adapters (mount/update/unmount).
- `e2e/cross.spec.ts` (`@cross`) — config.json override / fallback; `/dashboard` R19 inside R17 shell + host customer KPI + theme
  update; `/customers/new` validation → submit → toast, count +1, redirect, row in table; Home
  widgets + bump (`update()` on the same root); navigate-away unmount; click bubbling from the
  R19 remote to an R17 host ancestor's `onClick` (documented ADR 0001 behaviour, asserted);
  `route.abort` of app19 `remoteEntry.js` → `remote-error`, shell/nav keep working, Retry recovers.

`infra/` (CDK, ADR 0003) is a separate project with its own README; it is excluded from
`tsconfig`, Vite's dep scan/watch, and Playwright.
