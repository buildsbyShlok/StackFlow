# Deployment preparation

This guide assumes the directory containing `package.json`, `render.yaml`, and this `docs` folder is the Git repository root. Locally it is `S:\PROJECTS\StackFlow\stackflow`. There is no backend `package.json`: API dependencies and scripts live in the root package.

## GitHub handoff

The supplied directory was not a Git repository when inspected on 2026-10-26. No branch, remote, staged files, or history existed to inspect. Git initialization, the intended GitHub URL, and target branch require the owner's confirmation. Do not infer the destination from a project name. Inspect remote history before the first push; never force-push over an existing repository.

The root `.gitignore` excludes local environment files (including environment variants), dependencies, builds, credentials, logs, and database artifacts. Only placeholder `.env.example` / `.env.*.example` files are allowed. The `.artifacts` directory contains local diagnostics and disposable test databases; it must remain excluded. Do not stage the entire parent `S:\PROJECTS\StackFlow` folder.

## Hosting settings

| Setting | Render API | Vercel frontend |
| --- | --- | --- |
| Root Directory | Repository root (leave blank) | `stackflow-frontend` |
| Runtime | Node 24.22.1, pinned in Blueprint and `.node-version` | Node 24.x in project settings |
| Install/build | `npm ci --omit=dev` | Install: `npm ci`; build: `npm run build` |
| Start | `npm start` | Vercel serves `dist` |
| Health | `/api/health` | Same-origin `/api/health` proxies to Render |

Node 22.12+ within major 22 and Node 24 are supported by both manifests. The backend is plain JavaScript and needs no compile step. It binds `0.0.0.0` on Render's `PORT`, reports database readiness through health, and drains connections before disconnecting MongoDB on shutdown.

If a future repository instead includes this application under an extra `stackflow/` folder, adjust both service roots and the Blueprint location before importing. Do not use `stackflow-backend` as the Render root.

## MongoDB Atlas

1. Create/select the intended Atlas cluster and an application database (for example, `stackflow`). No migration of local data is performed by these instructions or the deployment code.
2. Create a database user with access limited to that application database. Use Atlas's Drivers connection string, including an explicit database path. Production validation expects the Atlas `mongodb+srv` form with a `.mongodb.net` hostname. Percent-encode special characters in credentials. Do not disable TLS verification.
3. Allow the Render service's outbound IP ranges in Atlas Network Access. Get the ranges from the actual Render service; no addresses are assumed here. Atlas accepts connections only from its configured access list. [Atlas access-list documentation](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
4. Store the complete connection string only in Render's **DB_URI** variable. Do not put it in Vercel, Git, this guide, or a `VITE_` variable. This project does not use `MONGO_URI` or `MONGODB_URI`.

Existing integration/browser scripts create and remove only their own uniquely named test databases. Use local MongoDB or an isolated test cluster for these scripts, never production credentials.

## Render

After the approved repository has been pushed, import its `render.yaml` as a new Blueprint. Review the `stackflow-api` name against existing services before applying. Choose a region near Atlas. The template specifies the free plan; review its suitability before relying on it for production traffic. It creates only the API, not an Atlas database or Vercel project.

| Variable | Required value |
| --- | --- |
| `NODE_ENV` | `production` (provided by Blueprint) |
| `NODE_VERSION` | `24.22.1` (provided by Blueprint) |
| `DB_URI` | Secret Atlas SRV connection string with application database |
| `FRONTEND_URL` | Actual Vercel/custom HTTPS origin, no trailing slash; comma-separated exact origins if needed |
| `ACCESS_SECRET` | Independent random value of at least 32 characters |
| `REFRESH_SECRET` | A different random value of at least 32 characters |
| `TRUST_PROXY` | `1` in template; trust only the verified number of proxy hops |
| `PORT` | Supplied by Render; no manual value needed |

The Blueprint generates each JWT secret separately and requests `DB_URI` and `FRONTEND_URL` during initial creation. For an existing service, configure missing `sync: false` values in its dashboard; later Blueprint syncs do not prompt again. See [Render environment settings](https://render.com/docs/configure-environment-variables) and [Blueprint reference](https://render.com/docs/blueprint-spec).

Create/select the Vercel project to obtain its actual assigned frontend origin before completing Render's `FRONTEND_URL`. It is fine for the frontend's first build to precede a healthy API; the site is not ready for use until both are connected. No production URLs are guessed in these files.

The login limiter is in-memory and keyed by Express `req.ip`. The template trusts one Render-facing hop, not arbitrary forwarded headers. Verify client-IP handling through the deployed Vercel-to-Render path before changing this setting or increasing traffic. If Vercel egress addresses are grouped as one client, use a verified proxy topology or shared identity-aware limiter; do not blindly set trust proxy to `true`. [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/).

## Vercel and authentication

Import the same GitHub repository and select `stackflow-frontend` as Root Directory. Use Vite and the settings above. Set `BACKEND_URL` in the intended Vercel environment to the actual HTTPS Render origin, without a trailing slash or `/api`, then deploy/redeploy. Missing `BACKEND_URL` leaves the route variable unresolved and the API will fail.

Production frontend bundles always request `/api` on their own origin. `vercel.json` forwards `/api/*` to `${BACKEND_URL}/api/*`, serves real static files next, and sends remaining routes to `index.html`. This preserves deep links. `VITE_API_BASE_URL` is for local development only and is deliberately ignored by production builds, preventing a local `.env` from baking localhost into a release.

The proxy uses Vercel's documented [environment-variable route destinations](https://vercel.com/docs/project-configuration/vercel-json#using-environment-variables-in-routes). `BACKEND_URL` is routing configuration, not a browser secret. No database credentials or JWT signing secrets belong in Vercel for this architecture.

Refresh cookies remain HttpOnly, Secure in production, SameSite=Lax, host-only, and scoped to `/api/auth`. The same-origin proxy avoids dependence on third-party cookie support. The API enforces the exact frontend origin, credentialed CORS, and no-store responses. Preserve cookies, authorization headers, Origin, query strings, and request bodies in any future proxy changes.

Preview environments must use an isolated backend/database and explicitly allowed preview origin. Do not wildcard-allow every `vercel.app` origin or connect unreviewed previews to production data. `vite preview` alone does not emulate Vercel's `/api` routing.

## Verification before declaring live

- Run `npm test`, `npm run check:backend`, `npm run typecheck`, `npm run lint`, `npm run build`.
- With local MongoDB available, run `npm run test:integration`, `npm run test:transactions`, and `npm run test:browser`.
- Validate the Blueprint with `render blueprints validate render.yaml` when Render CLI/access are available. JSON Schema validation is useful but does not replace platform validation.
- Confirm the deployed Render `/api/health` and frontend `/api/health` both return 200 with `status: ready`.
- On the real HTTPS frontend, register/sign in, reload to restore the refresh session, create a test project/task, verify it with the appropriate role, then sign out and confirm protected routes require sign-in. Use designated deployment test accounts.
- Open and refresh a deep link. Check browser requests use the frontend `/api`, static assets load, and responses containing auth/workspace data are not cached.
- Check disallowed Origin requests receive 403 and secrets never appear in build logs or browser assets. Verify client-IP limiting through the real proxy path.

No service creation, Atlas connection, deployment, or public accessibility is implied by local test results.
