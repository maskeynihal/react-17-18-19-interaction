# ADR 0002 — Remote URL resolution

Status: Accepted (2026-11-20)

## Context
Each app must know where the other's `remoteEntry.js` lives per environment
(local, staging, prod). Build-time `VITE_*` URLs force rebuilding an app every
time the other moves, coupling deploys.

## Decision
- Remote URLs are read at **runtime** from `/config.json` served next to
  `index.html` (`{ "remotes": { "app19": "https://…/remoteEntry.js" } }`), and
  registered with the MF runtime (`registerRemotes`) before first load.
- Fallback to build-time `VITE_REMOTE_*` env and then localhost defaults.
- `config.json` and `remoteEntry.js` are served `no-cache`; hashed assets are
  `immutable`.

## Consequences
- One artifact promotes across environments; only `config.json` changes.
- Extra request at startup (small, cacheable with revalidation).
