# Product brief — React 17 ⇄ React 19 interop

## Problem
The main portal is a React 17 app that hosts every existing feature. New work is
being built in a separate React 19 app. Users must be able to use both, and
features must flow **both ways**:

- React 17 portal embeds React 19 pages/components (new features reach users
  through the existing portal without upgrading the portal).
- React 19 app embeds React 17 pages/components (new app can reuse legacy
  features until they are rewritten).

The two apps are **separate repos** with separate builds and deploys.

## Goals
1. Each app runs standalone with its own React version.
2. Each app exposes pages/widgets the other can load at runtime.
3. Apps interact: props down (data + callbacks), events across (event bus).
4. Playwright e2e in both repos proves imports in both directions.
5. AWS hosting design + CDK code (synth-verified, not deployed).

## Non-goals
- Sharing a single React instance (impossible across major versions).
- Sharing React context/router/providers across the boundary.
- Real backend/auth. Data is in-memory mock.
- React 18 app (pattern identical; can be added later).
- Deploying to AWS.

## Demo app
| App | Repo | Port | Federation name | React |
|---|---|---|---|---|
| Main portal | `react17-portal/` | 5170 | `portal17` | 17.0.2 |
| New app | `react19-app/` | 5190 | `app19` | 19.x |

Features:
- **Dashboard** (built in R19): KPI cards, bar chart, recent customers table.
- **Customer form** (built in R19): validated form using React 19 actions.
- **Stats widget** (built in R19): small KPI card embedded on portal home.
- **Users page** (built in R17): searchable user table, select a user.
- **Profile card** (built in R17): user card embedded on R19 dashboard.
- **Profile form** (built in R17): legacy form, portal only.

## Acceptance criteria
- AC1 Portal `/dashboard` renders R19 Dashboard; root reports React 19.x while
  portal shell reports 17.0.2.
- AC2 Portal `/customers/new` renders R19 form; submit calls host callback;
  portal shows toast + increments customer count in header.
- AC3 Portal home embeds R19 StatsWidget; host prop changes propagate via
  `update()`.
- AC4 R19 app `/legacy/users` renders R17 UsersPage (reports 17.0.2);
  selecting a user calls host callback and emits `mfe:user-selected`.
- AC5 R19 dashboard embeds R17 ProfileCard.
- AC6 Navigating away unmounts remote; DOM removed; no console errors.
- AC7 No console errors on any e2e page (duplicate React / hooks errors fail).
- AC8 Remote unavailable → host shows fallback error UI, rest of app works.
- AC9 Each repo has Playwright e2e covering its own pages and the imports.
- AC10 CDK app synthesizes S3 + CloudFront per app with CORS, cache policy and
  SPA rewrite.
