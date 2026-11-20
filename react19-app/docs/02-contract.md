# Integration contract (source of truth for both repos)

Both repos copy the TypeScript in §3 verbatim into `src/mfe/contract.ts`.
Change it here first, then in both repos.

## 1. Toolchain (pinned, validated by spike 2026-11-20)
| | react17-portal | react19-app |
|---|---|---|
| react / react-dom | 17.0.2 | 19.3.1 |
| vite | 8.3.8 | 8.3.8 |
| @vitejs/plugin-react | 6.3.0 | 6.3.0 |
| @module-federation/vite | 1.24.1 | 1.24.1 |
| router | react-router-dom 6.x (supports React 17) | react-router 7.x |
| language | TypeScript | TypeScript |
| e2e | @playwright/test 1.65.1 | @playwright/test 1.65.1 |
| Node | 24 | 24 |

## 2. Federation
| | react17-portal | react19-app |
|---|---|---|
| name | `portal17` | `app19` |
| port (dev + preview, strictPort) | 5170 | 5190 |
| entry | `/remoteEntry.js` (dist root) | `/remoteEntry.js` |
| shared | `{}` — never share react/react-dom/jsx-runtime | `{}` |
| shareStrategy | `'loaded-first'` | `'loaded-first'` |

`shareStrategy: 'loaded-first'` is required: under default `version-first`
the plugin eagerly fetches the build-time remoteEntry and registers the static
remote under a mangled name, so runtime `registerRemotes` override silently
does nothing. Override by looking remote up by name **or alias** via
`getInstance()` and re-registering with `force: true`. Strip the injected
`<link rel="modulepreload" href="…/remoteEntry.js">` from `index.html` (it
hard-codes build-time URL and errors when the remote is down).

Exposes:
| repo | expose key | file | props type |
|---|---|---|---|
| react19-app | `./DashboardPage` | `src/exposed/DashboardPage.tsx` | `DashboardPageProps` |
| react19-app | `./CustomerFormPage` | `src/exposed/CustomerFormPage.tsx` | `CustomerFormPageProps` |
| react19-app | `./StatsWidget` | `src/exposed/StatsWidget.tsx` | `StatsWidgetProps` |
| react17-portal | `./UsersPage` | `src/exposed/UsersPage.tsx` | `UsersPageProps` |
| react17-portal | `./ProfileCard` | `src/exposed/ProfileCard.tsx` | `ProfileCardProps` |

Every exposed module: `export const mount: MountFn<P>` and `export default mount`.

Remote remotes config (static default, `type: 'module'`, `entryGlobalName` = name,
`shareScope: 'default'`). Runtime override per ADR 0002: at boot, fetch
`/config.json` (`{ "remotes": { "<name>": "<url to remoteEntry.js>" } }`), if
present call `registerRemotes([...], { force: true })` from the MF runtime, then
load modules with `loadRemote('<name>/<Expose>')`. Missing/invalid config.json
→ keep default (env `VITE_REMOTE_APP19` / `VITE_REMOTE_PORTAL17`, else
localhost URL). Ship `public/config.json` with localhost URLs.

> **Note (ADR 0004, bundled feature packages — default mode).** The same
> exposes are also published as npm packages built in Vite library mode with
> the producer's React bundled in: `@mfe/app19-features` (`./DashboardPage`,
> `./CustomerFormPage`, `./StatsWidget`) and `@mfe/portal17-features`
> (`./UsersPage`, `./ProfileCard`); each export is the same `mount` adapter,
> CSS self-injected (`<style id="mfe-<pkg>-css">`, still `.r17-*`/`.r19-*`
> scoped), types in `contract.d.ts`. `config.json` gains
> `"mode": "bundled" | "remote"`; missing/invalid → `bundled`. In `bundled`
> the host `RemoteMount` resolves `'<name>/<Expose>'` via a loader map to
> `import('@mfe/<pkg>/<Expose>')` and nothing is fetched from the sibling. In
> `remote` everything above applies. Static `remotes` were removed from the
> federation plugin config (no build-time preload/eager fetch); in remote mode
> the host registers them at runtime from `config.json` (else the build-time
> default `VITE_REMOTE_*`), so the alias/modulepreload workarounds above no
> longer apply.

## 3. Types (`src/mfe/contract.ts`, identical in both repos)
```ts
// ---- mount adapter ----
export interface MountHandle<P> {
  update(props: P): void;
  unmount(): void;
}
export type MountFn<P> = (el: HTMLElement, props: P) => MountHandle<P>;
export interface RemoteModule<P> {
  mount: MountFn<P>;
  default?: MountFn<P>;
}

// ---- shared domain (plain data only) ----
export type Plan = 'free' | 'pro' | 'enterprise';
export interface Customer {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  createdAt: string; // ISO
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

// ---- props every remote receives ----
export interface HostProps {
  /** host owns routing; remote never uses its own router when embedded */
  navigate: (path: string) => void;
  /** host-provided theme token, remote applies it via data attribute */
  theme: 'light' | 'dark';
  /** identifies host for telemetry/testing, e.g. 'portal17' | 'app19' */
  host: string;
  /**
   * Called by the remote when it fails at render/update time (error boundary
   * in R17 adapter, createRoot onUncaughtError/onCaughtError in R19 adapter).
   * Host shows its remote-error fallback. Remote must never let a render
   * error escape `mount()`/`update()` synchronously.
   */
  onError?: (error: unknown) => void;
  /** host debug mode: remote may show boundary labels/version badges */
  debug?: boolean;
}

// react19-app exposes
export interface DashboardPageProps extends HostProps {
  customers: Customer[]; // host-owned data source
  currentUser?: User;
}
export interface CustomerFormPageProps extends HostProps {
  onSubmit: (customer: Customer) => void | Promise<void>;
  onCancel?: () => void;
}
export interface StatsWidgetProps extends HostProps {
  label: string;
  value: number;
  trend?: number; // percent
}

// react17-portal exposes
export interface UsersPageProps extends HostProps {
  onSelectUser: (user: User) => void;
  selectedUserId?: string;
}
export interface ProfileCardProps extends HostProps {
  user: User;
}

// ---- cross-app events (window CustomEvent) ----
export interface MfeEvents {
  'mfe:customer-created': Customer;
  'mfe:user-selected': User;
  'mfe:navigate': { path: string };
}
export type MfeEventName = keyof MfeEvents;
export function emit<K extends MfeEventName>(name: K, detail: MfeEvents[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
export function on<K extends MfeEventName>(
  name: K,
  handler: (detail: MfeEvents[K]) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<MfeEvents[K]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
```

## 4. Rules
1. Only plain data, functions and `mfe:*` events cross the boundary. No React
   context, router, providers, refs or React elements.
2. Exposed pages must render without router context. They navigate via
   `props.navigate`. Standalone app routes wrap the same inner components.
3. `mount` must render a root element with
   `data-mfe="<expose name>"` and `data-react-version={React.version}`.
4. Remote emits events **and** calls callbacks: callback for host-specific
   behaviour, event for anyone listening. (CustomerForm submit: call
   `onSubmit(customer)` then `emit('mfe:customer-created', customer)`.)
5. Never place a remote `<form>` inside a host `<form>`.
6. Remote CSS must be scoped (CSS modules or a prefix class `.r19-*` /
   `.r17-*`) so it can't restyle host.
7. Remote load failure: host `RemoteMount` shows
   `<div role="alert" data-testid="remote-error">` with retry button; rest of
   host keeps working.
8. Each app also exposes `window.__APP_REACT_VERSION__ = React.version` on its
   own shell root via `data-react-version` on `#root > [data-app-shell]`.

9. **Error containment** (QA round 1): adapters wrap the tree in an error
   boundary and report via `props.onError`; `update()`/`unmount()` never throw
   (try/catch, `mounted` guard — update after unmount is a no-op). Host
   `RemoteMount` also try/catches `mount`/`update` and shows `remote-error`.
10. **Timeouts**: remote load (`loadRemote`) races a timeout (default 10 s;
    `config.json` may set `"remoteTimeoutMs"`) → `remote-error`. Fetching
    `config.json` races 3 s timeout. App shell renders immediately and never
    waits for `config.json`; only remote loading awaits it.
11. **Remote registration**: always `registerRemotes` for the other app with
    `force: true`, using config URL if valid else build-time default injected
    via `define` (`VITE_REMOTE_*` env, else localhost). Missing / 404 / `{}` /
    invalid JSON / non-http(s) / disallowed origin → default.
12. **Config URL allowlist**: URL parsed with `new URL()`, protocol http(s),
    origin must be in build-time `VITE_ALLOWED_REMOTE_ORIGINS` (comma list;
    default `http://localhost:5170,http://localhost:5190`). Rejected → warn +
    default.
13. **UX**: friendly fallback copy "This section is unavailable." + Retry;
    technical detail in collapsed `<details>` (no overflow, `overflow-wrap:
    anywhere`); host keeps page `<h1>`. Loading copy plain ("Loading
    dashboard…"). Jargon (module names, "embedded via Module Federation",
    click counters) only in debug mode (`?debug=1`, persisted to
    sessionStorage); small React version pill in shell header always shown.
    Both apps fully support `theme` light/dark: remote root sets its own
    background + text colours from its own tokens so it is legible on any
    host; all text (headings, table stripes, badges, focus rings) must meet
    contrast in both themes. Mobile 390px: no horizontal page scroll; tables
    in `overflow-x:auto` wrappers; KPI grids `repeat(auto-fit,minmax(…,1fr))`.

## 5. Host `RemoteMount` (each repo writes its own, in its React version)
Props: `remote: string` (e.g. `'app19/DashboardPage'`), `props: P`,
`fallback?`. Behaviour:
- `loadRemote(remote)` once per remote name (cache promise).
- mount into a `<div data-remote="<remote>">` on load; `update(props)` on
  every props change; `unmount()` on cleanup (defer with `setTimeout(0)` to
  avoid unmounting a root during the other React's render).
- Loading state: `data-testid="remote-loading"`.

## 6. Routes
react17-portal (shell header shows "Main Portal · React 17.0.2" + customer count badge `data-testid="customer-count"`):
- `/` Home — welcome, R17 ProfileForm link, embeds `app19/StatsWidget` ×2 (customers count, revenue) with a host-side "bump" button changing props.
- `/users` — own R17 UsersPage (standalone route).
- `/profile` — own R17 ProfileForm.
- `/dashboard` — `app19/DashboardPage` with host customers list.
- `/customers/new` — `app19/CustomerFormPage`; onSubmit adds to host store, shows toast `data-testid="toast"`, navigates to `/dashboard`.

react19-app (shell header "New App · React 19.x"):
- `/` Dashboard — own DashboardPage; embeds `portal17/ProfileCard` for current user.
- `/customers/new` — own CustomerFormPage (uses `useActionState`, `useFormStatus`).
- `/legacy/users` — `portal17/UsersPage`; on select shows selected user banner `data-testid="selected-user"`.

## 7. Dev workflow
- Both `npm run dev`: own HMR works; editing the *other* app doesn't hot-update
  in host (two React Refresh runtimes). Workaround: run the other app with
  `npm run build && npm run preview` (or `npm run serve`).
- A preview/prod host cannot consume a dev-server remote (refresh preamble
  error). E2E always uses preview builds.
