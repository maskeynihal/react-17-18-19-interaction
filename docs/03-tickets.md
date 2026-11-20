# Tickets

| ID | Ticket | Repo | Depends | AC |
|---|---|---|---|---|
| T0 | Spike Vite MF R17⇄R19, nothing shared | spike/ | – | done, see contract §1 |
| T1 | Scaffold react19-app (Vite 8, TS, MF host+remote, router, config.json runtime remotes) | react19-app | T0 | builds, dev+preview on 5190 |
| T2 | R19 features: Dashboard, CustomerForm (actions), StatsWidget + mount adapters | react19-app | T1 | AC1–AC3 (remote side) |
| T3 | R19 host: RemoteMount, `/legacy/users`, ProfileCard on dashboard, error fallback | react19-app | T1 | AC4, AC5, AC8 |
| T4 | Scaffold react17-portal (Vite 8, TS, React 17, MF host+remote, RR6) | react17-portal | T0 | builds, dev+preview on 5170 |
| T5 | R17 features: UsersPage, ProfileCard, ProfileForm + mount adapters | react17-portal | T4 | AC4, AC5 (remote side) |
| T6 | R17 host: RemoteMount, `/dashboard`, `/customers/new`, Home widgets, toast + count | react17-portal | T4 | AC1–AC3, AC8 |
| T7 | Playwright in both repos (own pages + cross imports, console-error guard, version assertions, unmount, fallback, bubbling) | both | T2,T3,T5,T6 | AC6, AC7, AC9 |
| T8 | CDK infra per repo + docs/04-aws-infra.md | both/infra | – | AC10 |
| T9 | Integration run: both previews, both e2e suites | both | T7 | all green |
| T10 | QA + blind review + release gate doc | docs | T9,T8 | docs/05-release.md |
