# QA round 1 — findings to fix

Sources: adversarial QA (code review + Playwright probes) and blind UX review (screenshots at 1280/390px).
Contract updated: docs/02-contract.md HostProps.onError/debug, rules 9–13.

| ID | Sev | Repo | Finding | Fix |
|---|---|---|---|---|
| Q1 | High | app19 | Missing/404/`{}`/invalid config.json → portal17 never registered (`getInstance().options.remotes` is `[]`), RUNTIME-004. `VITE_REMOTE_PORTAL17` ineffective. No e2e for fallback. | Rule 11. Add e2e for 404, `{}`, invalid JSON, disallowed origin. |
| Q2 | High | both | R17 remote throwing in `update()` blanks whole R19 host (`#root` empty). | Rule 9: R19 RemoteMount try/catch around update; R17 adapters error boundary + onError + mounted guard. e2e: inject throw via route-patched chunk or a test-only prop (e.g. `__throw` honored only when `debug`) — prefer prop `simulateError?: 'render'` only in debug. |
| Q3 | Med | both | R19 remote render throw inside portal → silent empty slot. | R19 adapter `createRoot(el,{onUncaughtError,onCaughtError})` + inner ErrorBoundary → props.onError; portal RemoteMount shows remote-error. e2e. |
| Q4 | Med | portal | Whole portal blank until config.json resolves, no timeout. | Rule 10: render immediately. e2e with never-resolving config.json → shell + /users visible. |
| Q5 | Low-Med | both | No remote load timeout; blackholed remoteEntry → loading forever. | Rule 10. e2e with short `remoteTimeoutMs` in routed config.json. |
| Q6 | Low | app19 | `requestSubmit()` twice → 2 customers. | In-flight guard / id per form instance. |
| Q7 | Low (sec) | both | config.json can point remote anywhere (data: URL executed in portal). | Rule 12 allowlist. e2e: data: URL / other origin rejected → default. |
| Q8 | Latent | portal | R17 adapter update after unmount re-renders into detached el. | `mounted` guard. |
| Q9 | Latent | both infra | Deploy without `-c remotes` ships localhost config.json; allowedOrigins default localhost. | When `-c env=prod` (or any env != dev), synth fails unless `remotes` and `allowedOrigins` given. Test it. |
| Q10 | Nit | app19 | `window.__APP_REACT_VERSION__` missing (rule 8). | Set it. |
| U1 | High | both | Dark theme: R17 users table stripes/badges/focus illegible in R19 dark; R19 H1 invisible inside portal dark; portal shell barely themes. | Rule 13: each remote root paints own bg/text from own tokens per theme; portal shell implements real dark theme. |
| U2 | High | portal | Remote-down fallback prints raw MF error, overflows, loses H1, duplicated per widget. | Rule 13 copy; `<details>` for tech; H1 in host route; Home widget group shows single fallback (one RemoteMount group or dedupe). |
| U3 | High | app19 | Dashboard overflows at 390px (page 476–479px). `.r19-page-head`, `.r19-kpis`, `.r19-stats-card`, table. | Rule 13 responsive. e2e: at 390 width `document.documentElement.scrollWidth <= 390` on dashboard in both hosts (portal side too). |
| U4 | Med | portal | Profile save doesn't update header "Signed in as". | Lift profile to shell state. |
| U5 | Med | both | Jargon labels + debug counters visible. | Rule 13 debug mode; tests that need counters use `?debug=1`. |
| U6 | Med | app19 | Form a11y: focus first invalid field after failed submit, error summary/live region, name error copy "Name must be at least 2 characters", `required` attrs. | Fix + e2e focus assertion. |
| U7 | Med | portal | Toast outside shell column, overlaps footer/table on mobile. | Position within viewport bottom-right with max-width, `role=status`. |
| U8 | Med | portal(R17 ProfileCard) | Role badge CSS missing when embedded in R19; card stays light in dark. | Badge styles inside ProfileCard css chunk; theme support. |
| U9 | Low | app19 | 404 bare text. | H1 + link home. |
| U10 | Low | portal | Home StatsWidgets odd gap; selected user row only bold + width shift; nav tab width jump; profile inputs touch edge mobile. | Polish. |
