# ADR 0001 — Module Federation + framework-agnostic mount adapters

Status: Accepted (2026-11-20)

## Context
React 17 portal and React 19 app are separate repos, both built with Vite.
Features must be imported both ways at runtime. Two React majors cannot share
one instance (hooks dispatcher, reconciler internals, JSX runtime differ).

## Decision
- Use `@module-federation/vite` in both apps. Each app is **host and remote**.
- **Nothing React-related is shared** (`react`, `react-dom`, `react/jsx-runtime`
  are bundled per app). Each exposed module ships with its own React.
- Exposed modules never export React components. They export a
  **mount adapter**: `mount(el, props) → { update(props), unmount() }`.
  - R17 implements it with `ReactDOM.render` / `unmountComponentAtNode`.
  - R19 implements it with `createRoot(el).render` / `root.unmount()`.
- Host wraps remotes in a local `<RemoteMount>` component (its own React
  version) that lazy-loads the module, calls `mount` once, `update` on prop
  change, `unmount` on cleanup, and renders error fallback on load failure.
- Only plain JS crosses the boundary: serialisable data, functions
  (callbacks), and DOM CustomEvents (`mfe:*`). No context, router or
  providers cross it. Remote pages navigate by calling `props.navigate(path)`.

## Alternatives
- **Web components**: framework-agnostic, but props limited to
  attributes/properties, worse typing; adds shadow-DOM styling issues. The
  mount contract is equivalent and can be wrapped as a custom element later.
- **Iframes**: strongest isolation, poor UX (sizing, routing, shared state).
- **npm packages**: compile-time; consumer must run same React major → fails.
- **single-spa**: similar idea, more framework; mount contract is a subset.

## Consequences
- Bundle includes two Reacts when embedding (~45 KB gz extra). Acceptable.
- React synthetic events from nested root still bubble through the DOM to the
  host's root listener (both 17 and 19 attach at root container), so host
  ancestors' `onClick` can fire for clicks inside remote. Remote wrappers
  should not have click handlers expecting otherwise. See e2e.
- Never nest a remote `<form>` inside a host `<form>`.
- Contract is bundler-independent: a webpack host could consume same remotes
  through `@module-federation/enhanced`.
