# react19-app — New App (React 19)

The new app in the React 17 ⇄ React 19 interop demo. It is both:

- a **standalone app** (React 19.3.1, react-router 7) with a customer dashboard, a customer form built with
  React 19 actions, and a `/legacy/users` page; and
- a **Module Federation remote** named `app19` that exposes framework-agnostic mount adapters the React 17
  portal (`react17-portal`, separate repo) embeds; and
- a **Module Federation host** that embeds the portal's React 17 `UsersPage` and `ProfileCard`.

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
| Consumes | `portal17` → `http://localhost:5170/remoteEntry.js` |

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
| `npm run test:e2e` | Playwright (builds + previews this app, and the portal if found) |

Node 24. Versions are pinned exactly per contract §1.

## Remote URLs at runtime (ADR 0002)

At boot `src/mfe/remotes.ts` fetches `/config.json`:

```json
{ "remotes": { "portal17": "http://localhost:5170/remoteEntry.js" } }
```

and calls `registerRemotes([...], { force: true })` on the Module Federation runtime before the first
`loadRemote('portal17/…')`. A missing/invalid `config.json` keeps the build-time default
(`VITE_REMOTE_PORTAL17`, else `http://localhost:5170/remoteEntry.js`) from `vite.config.ts`. To deploy the same
build elsewhere, only replace `config.json` (serve it `no-cache`).

Implementation notes:

- `registerRemotes`/`loadRemote`/`getInstance` are imported from `@module-federation/runtime@2.9.3` — the exact
  package the `@module-federation/vite` plugin's generated init code imports, so the bundle contains a single
  runtime copy (one `dist/assets/dist-*.js` chunk, shared by `index` and `remoteEntry.js`).
- `shareStrategy: 'loaded-first'`: nothing is shared, and the default `version-first` would fetch the portal's
  `remoteEntry.js` eagerly at boot from the build-time URL, before `config.json` could override it.
- A small build plugin strips the `<link rel="modulepreload" href="http://…/remoteEntry.js">` the federation
  plugin adds to `index.html` for the same reason.

## Running with the portal

The portal is a separate repo (`react17-portal`, port 5170). Locally, check both out side by side:

```sh
# terminal 1 — portal (preview build; a preview host can't consume a dev-server remote)
cd ../react17-portal && npm run build && npm run preview
# terminal 2 — this app
npm run dev        # or: npm run build && npm run preview
```

Open http://localhost:5190. If the portal is down, the ProfileCard / UsersPage areas show a
`role="alert"` fallback with a Retry button; the rest of the app keeps working.

### Dev-mode HMR limitation (contract §7)

Each app's own HMR works under `npm run dev`. Editing the *other* app does not hot-update inside this host (two
React Refresh runtimes). Run the other app as `npm run build && npm run preview` and reload. A preview/prod
host cannot consume a dev-server remote (React Refresh preamble error), so e2e always uses preview builds.

## E2E (Playwright)

```sh
npx playwright install chromium   # once
npm run test:e2e                              # everything (needs the portal checkout)
npm run test:e2e -- --grep-invert @cross      # standalone only, no portal needed
PORTAL17_DIR=/path/to/react17-portal npm run test:e2e
```

- `webServer` builds and previews this app on 5190 and, **if `${PORTAL17_DIR:-../react17-portal}/package.json`
  exists**, the portal on 5170. Existing servers are reused unless `CI` is set. In CI, check out both repos
  (e.g. portal into `../react17-portal` or set `PORTAL17_DIR`) and run `npm ci` in both.
- `e2e/fixtures.ts` fails any test that logs a console `error` or a `pageerror` (catches duplicate-React /
  invalid-hook / unmount-race errors). Tests that deliberately break the network allow only that exact message.
- `e2e/standalone.spec.ts` — KPIs, validation errors, successful submit → event + dashboard update, fallback when
  the portal is unreachable (portal requests are aborted, so it runs without the portal).
- `e2e/cross.spec.ts` (`@cross`) — `/legacy/users` renders `[data-mfe=UsersPage]` on React 17.0.2 inside a
  React 19 shell; selecting a user → callback + `mfe:user-selected` + banner; ProfileCard on the dashboard is
  17.0.2; theme propagates via `update()`; navigating away removes the remote DOM; aborting the portal
  `remoteEntry.js` shows `remote-error` and Retry recovers; `config.json` override is honoured; and the documented
  behaviour that clicks inside the React 17 remote **bubble to the React 19 host's `onClick`** (ADR 0001).

## Layout

```
src/
  main.tsx, App.tsx          standalone shell bootstrap + routes
  shell/                     header/nav (data-app-shell, data-react-version)
  pages/                     standalone routes wrapping the inner components
  features/                  router-free Dashboard, CustomerForm, StatsCard, MfeRoot
  exposed/                   mount adapters (createRoot) for federation
  mfe/contract.ts            verbatim contract
  mfe/remotes.ts             config.json → registerRemotes, cached loadRemote
  mfe/RemoteMount.tsx        host wrapper: loading / error+retry / update / deferred unmount
  store/customerStore.ts     in-memory customers (seeded) + current user
e2e/                         Playwright specs + console-error fixture
infra/                       CDK (separate package, excluded from app tsconfig/vite)
```
