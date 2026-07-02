# GitHub Actions Orchestrator — Viewer

Operations dashboard for the [GithubActionsOrchestrator](../GithubActionsOrchestrator)
autoscaler. Shows runners, jobs and stuck jobs, and can act on them
(create/delete runners, reschedule stuck jobs).

Built with **Vite + Vue 3 + PrimeVue**.

## Features

- **Dashboard** – live stat cards (active/online runners, create/delete/provisioning
  queues, stuck & throttled jobs) plus runner/job/cloud breakdowns.
- **Runners** – server-side paginated, sortable, filterable table (status, cloud,
  owner, size, profile, online-only, free-text search). Row actions: copy SSH,
  details drawer with full lifecycle timeline, delete runner. Toolbar actions:
  create runner, kill all non-processing runners.
- **Jobs** – paginated/sortable/filterable table (state, owner, repository, size,
  stuck-only) with reschedule action for queued/throttled jobs.
- **Stuck Jobs** – dedicated view of jobs queued longer than the orchestrator's
  threshold, with per-job and bulk reschedule.
- Auto-refresh on every view, connectivity indicator, dark theme.

## Configuration

Environment variables (Vite requires the `VITE_` prefix):

| Variable        | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `VITE_API_URL`  | API base URL. **Leave empty** for the same-origin nginx proxy (default). |
| `VITE_API_KEY`  | Shared API key sent as `X-API-KEY` on every request. May be blank.       |

Set these in `.env.development` / `.env.production`, or override at build time.

### Authentication & authorization

Two layers, both anchored on **Teleport** (which fronts the viewer):

1. **Same-origin proxy + Teleport JWT (authorization).** The viewer's nginx
   reverse-proxies `/api` to the orchestrator on the same origin
   (`nginx/default.conf.template`). Because it's same-origin, Teleport's signed
   `Teleport-Jwt-Assertion` header rides along on every API request; nginx forwards
   it to the orchestrator, which **verifies the JWT against Teleport's JWKS** and
   **gates all mutating endpoints** (create / delete / reschedule / cancel / cleanup /
   kill / clear) on an allowlist of roles/users. Read-only endpoints stay open.
   The SPA reads `GET /api/me` to show the current user and disable action buttons
   when they aren't authorized. During local dev the Vite dev server proxies `/api`
   (`VITE_DEV_API_TARGET`, default the public orchestrator).

2. **API key (coarse gate).** The shared key is baked into the bundle and sent as
   `X-API-KEY`; the orchestrator rejects mismatches with `401`. In CI the key is
   injected from the `VIEWER_API_KEY` repository secret (see
   `.github/workflows/build.yaml`). A blank key works when the orchestrator has no
   `ApiKey` configured (local dev).

The proxy upstream is set via the `ORCHESTRATOR_URL` / `ORCHESTRATOR_HOST` env vars
on the viewer container (defaulting to the public orchestrator address); point them
at the in-cluster service to keep API traffic internal.

#### Orchestrator config (`scalerConfig`)

Enable and tune authorization on the orchestrator side:

```yaml
TeleportAuth:
  Enabled: true
  JwksUrl: https://teleport.ethquokkaops.io/.well-known/jwks.json
  Issuer: teleport.ethquokkaops.io          # JWT "iss"; empty to skip
  Audience: https://<viewer-teleport-app>   # JWT "aud"; empty to skip
  AuthorizedRoles: [ "sre", "gh-runner-admin" ]
  AuthorizedUsers: []                        # optional per-user allowlist
```

When `Enabled: false`, mutating endpoints fall back to the API key only. When both
allowlists are empty, any authenticated Teleport user may mutate.

## Development

```
npm install
npm run dev      # Vite dev server on http://localhost:8080
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

## Deployment

`npm run build` emits a static bundle to `dist/`, served by nginx (see `Dockerfile`
and `nginx/default.conf.template`, which also reverse-proxies `/api`). Routing uses
hash history, so no SPA rewrite rules are required.

## Orchestrator API used

Identity: `GET /api/me` (current user, roles, `canMutate`).

Data: `GET /api/get-runners`, `/api/get-jobs`, `/api/get-stuck-jobs`,
`/api/stats`, `/api/filter-options`, `/api/get-runner/{id}`, `/api/get-job/{id}`.

Actions (require an authorized Teleport JWT when auth is enabled):
`POST /api/runners` (create), `POST /api/runners/{id}/delete`,
`POST /api/jobs/{id}/reschedule`, `POST /api/jobs/{id}/cancel`,
`POST /api/cleanup-stuck-creation`, `POST /api/kill-non-processing-runners`,
`POST /api/clear-creation-queue`.

List endpoints accept `limit`, `offset`, `sortField`, `sortOrder` and per-view
filter params, and return `{ items, total }` for server-side pagination.
