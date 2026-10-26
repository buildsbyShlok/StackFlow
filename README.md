# StackFlow

A small, focused workspace for projects, milestones, assigned tasks, and **human verification**. Built with React/TypeScript, Vite, Express, and MongoDB.

Plan an outcome, assign a Tech Lead, deliver tasks, request changes when needed, and verify the result. Progress counts verified tasks, not unchecked completion.

## Run on Windows

Use PowerShell. Install **Node.js 22.12+ (24 LTS recommended)** and **MongoDB Community Server**. MongoDB 8.3 and Node 24 were used for the recorded checks. Redis is **not required**.

### First setup

```powershell
cd S:\PROJECTS\StackFlow\stackflow
npm ci
npm --prefix stackflow-frontend ci
npm run setup
```

`setup` creates missing environment files with local defaults and two independently generated JWT secrets. It **never overwrites an existing .env** and does not print secrets. If an existing configuration points somewhere else, review it before running.

Check MongoDB:

```powershell
Get-Service MongoDB
```

If installed as a Windows service and stopped, run `Start-Service MongoDB` from an administrator PowerShell. Otherwise start `mongod` using your MongoDB installation and an existing data directory, or configure an Atlas connection in `stackflow-backend/.env`.

### Every subsequent run

```powershell
cd S:\PROJECTS\StackFlow\stackflow
npm run dev
```

This starts the API and Vite together. Keep the terminal open; Ctrl+C stops development.

- Application: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- Registration: [http://localhost:5173/register](http://localhost:5173/register)

Use **localhost consistently**, rather than mixing localhost and 127.0.0.1 in browser URLs, so cookies and the configured origin match.

To run in separate terminals, from the root:

```powershell
npm run dev:backend
# In a second terminal:
npm run dev:frontend
```

`npm start` runs only the API without watching files. `npm run build` produces the frontend in `stackflow-frontend/dist`; it does not deploy or serve the frontend.

## First workspace and workflow

1. Register using **Create workspace**. This creates an Admin and uses the workspace name you enter.
2. Open **Team**, copy the invite code, and share it with your team.
3. Other users register with **Join team**. They join as Teammates.
4. The Admin changes an appropriate member's role to **Tech Lead** on Team. The member refreshes the page to see their new role.
5. The Admin creates a project. An Admin or Tech Lead creates a milestone with a deadline; Tech Leads can assign new milestones only to themselves.
6. The assigned Tech Lead or Admin creates tasks, selects teammates, and sets priority and optional due dates.
7. A teammate starts their assigned task and submits it for review.
8. The milestone's Tech Lead or an Admin opens **Verification**, inspects the task, and verifies it or requests changes with a reason.
9. Changes requested work returns to the teammate. It can be resumed and resubmitted.
10. Accepted tasks increase milestone/project progress. The task's history records each action.

Use separate browser profiles or sign out between accounts when testing roles. There are no seeded accounts or demo responses in the application.

## Features and permissions

| Capability | Admin | Tech Lead | Teammate |
| --- | --- | --- | --- |
| Browse workspace projects, tasks, members, search | Yes | Yes | Yes |
| Create/edit project | Yes | No | No |
| Create milestone | Yes | Assigned to self | No |
| Edit/reassign milestone | Yes | No | No |
| Delete empty project/milestone | Yes | No | No |
| Create/edit/assign task | Yes | Own milestones | No |
| Start/submit/withdraw task | No | No | Own tasks |
| Verify/request changes/reopen review | Yes | Own milestones | No |
| Invite/remove members, grant Tech Lead | Yes | No | No |

Task metadata can be edited only before submission or after changes are requested. Only unstarted tasks without submission/review history can be deleted.

### Safe deletion

Admins can choose **Delete project** on project details or **Delete milestone** beside a milestone's actions. The dialog shows the name and requires typing it exactly. A project must have no milestones; a milestone must have no tasks. Delete eligible unstarted tasks individually, then their empty milestone, then the empty project. Started work and verification history block deletion and are retained. There is no destructive cascade or archive feature.

The API checks current organization, role, name and record version. Stale/repeated requests fail safely. A durable MongoDB guard serializes parent deletion and child creation across API processes. Replica sets/sharded clusters use transactions; standalone MongoDB supports this empty-record policy without transactions. Referential checks query actual children rather than trusting cached arrays. Successful milestone deletion removes its project reference, and progress continues to derive from persisted tasks.

### Profile and security

Open **Your profile** from the sidebar avatar/name (also available in mobile navigation). Edit your name, or change your password using the current password. Email, workspace and role are read-only. New passwords require at least 10 characters and at most 72 bytes. A password change invalidates all access/refresh sessions and returns you to sign in with the new password. Name edits do not rewrite historical activity. Profile remains available to accounts without a workspace.

Admins cannot leave or remove themselves. A member cannot leave, be removed, or change role while they own unfinished tasks or lead milestones. Reassign tasks or milestones first. Removing a member revokes their current session immediately.

Tasks have title, description, assignee, priority, optional due date, state, creation/submission/review times, reviewer, and history. Task tables support search, status/priority filters, sorting and pagination. Tasks open in accessible dialogs, and direct task links still work. Ctrl/Cmd+K searches projects, milestones, tasks, and people.

### State and progress rules

Existing persisted states remain valid:

```text
pending -> in_progress -> completed -> verified
pending ----------------> completed
completed -> changes_requested -> in_progress -> completed
completed -> in_progress          (assignee withdraws)
verified -> completed             (reviewer reopens with a reason)
```

`completed` is displayed as **In review**. It is not included in verified progress. Requesting changes requires a reason. Each accepted transition and its history are written atomically using a conditional status/version update; stale or duplicate transitions return HTTP 409.

Progress = verified task count / actual task count, rounded to an integer; zero tasks means 0%. Project progress is weighted across all its tasks. Cached progress fields and historical reference arrays are not trusted for reads. Due dates retain the selected calendar date, and overdue indicators use the end of that day in the viewer's local timezone.

## Configuration

In development, the API loads `stackflow-backend/.env`, regardless of the launch directory. With `NODE_ENV=production` set by the host, it reads only service environment variables. Frontend development configuration lives in `stackflow-frontend/.env`. Examples contain placeholders only.

| Variable | Local value / meaning |
| --- | --- |
| DB_URI | `mongodb://127.0.0.1:27017/stackflow` |
| PORT | `5000` |
| FRONTEND_URL | `http://localhost:5173`; comma-separated exact origins if needed |
| ACCESS_SECRET | Independent random secret, generated by setup |
| REFRESH_SECRET | A different random secret, generated by setup |
| NODE_ENV | `development` locally; `production` enables secure cookies |
| TRUST_PROXY | `0` locally; Render template uses `1`; verify proxy topology before changing |
| VITE_API_BASE_URL | Development only: `http://localhost:5000`; client appends `/api` |
| BACKEND_URL | Vercel routing only: real HTTPS Render origin without `/api` or trailing slash |

Production requires HTTPS, two distinct random secrets of at least 32 characters, exact `FRONTEND_URL` origins, and an Atlas `mongodb+srv` URI with an explicit application database and verified TLS. Production frontend builds always call same-origin `/api`; Vercel forwards these requests to Render so SameSite=Lax refresh cookies work on the frontend domain. Local legacy secrets shorter than 32 characters are accepted only if at least 24 characters; prefer generated secrets. The API rejects example placeholders. Restart Vite after changing frontend development environment variables.

## Deploy to Render, Atlas, and Vercel

See [the deployment guide](docs/DEPLOYMENT.md) for Git preparation, exact service roots and commands, environment settings, and the verification checklist. `render.yaml` configures the API; `stackflow-frontend/vercel.json` configures the API proxy and SPA routes. These files prepare deployment; they do not create services or deploy by themselves.

Access tokens last 15 minutes and stay in browser memory. An HttpOnly refresh cookie restores sessions and lasts seven days. Refresh tokens are hashed in MongoDB; logout clears both current and legacy cookie paths and revokes the session. Existing accounts and valid legacy task data need no destructive migration. Case-insensitive email lookup also supports older mixed-case account emails.

**Redis was removed from the execution path.** The verification queue is a MongoDB query for completed tasks. No worker approves tasks automatically. The old `/api/queue/failed` endpoint returns 410 to make the retirement explicit.

## Checks

From the repository root:

```powershell
npm run typecheck
npm run lint
npm run check:backend
npm test
npm run test:integration
npm run build
npm audit
npm --prefix stackflow-frontend audit
```

Browser workflow test, after installing Chromium once:

```powershell
npx playwright install chromium
npm run test:browser
```

- `npm test`: transition, permission, deadline, progress, production configuration, CORS and cookie tests; no database required.
- `test:integration`: real HTTP/MongoDB tests for authentication, refresh/logout, tenant isolation, assignment, rejection/verification, concurrent reviews, stale updates, progress, search, and membership.
- `test:browser`: real Chromium workflow across all three roles, keyboard search, focus containment, session recovery, desktop/tablet/mobile layouts, error recovery and screenshots.
- `npm run test:transactions`: runs the integration suite against a disposable local replica set on a free port. Requires `mongod`; defaults to `C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe`. Set `$env:MONGOD_BINARY` for another installation. It does not reconfigure the application service; temporary database/log files remain under ignored `.artifacts/replica-*` for diagnostics.
- Integration/browser tests connect to local MongoDB by default, create uniquely named `stackflow_test_*` / `stackflow_browser_test_*` databases, and drop only their own database during cleanup. They do not load the application's real .env. Override the test MongoDB server with `$env:TEST_MONGO_URI` if needed; the account must be able to create/drop these test databases.
- Browser checks use frontend port 5175 and an ephemeral API port. Port 5175 must be available. Screenshots are written to ignored `.artifacts/browser/`.
- Both dependency audits reported zero vulnerabilities on 2026-10-24. On 2026-10-26 both audit commands were attempted again, but the npm registry reset the connections (`ECONNRESET`), so current vulnerability status could not be refreshed. No dependencies were added or changed in this quality pass. A targeted `postcss-selector-parser` override supplies the existing security fix to Tailwind 3 and postcss-nested without a Tailwind 4 migration.

Recorded results on 2026-10-24: root/frontend dependency installation, TypeScript, lint, backend syntax, 10 unit checks, all integration scenarios, browser workflow and production build passed. See the context file for the current verification detail.

Quality pass on 2026-10-26: TypeScript, lint, backend syntax, 10 unit tests, 22 integration tests on standalone MongoDB and a disposable replica set, production build, and expanded Chromium lifecycle/profile tests passed. Node 22.17 and MongoDB 8.3 were used. Git metadata was absent in this provided directory; source comparison used an ignored local baseline rather than Git status/diff.

## Structure

```text
package.json / package-lock.json    API dependencies + root commands
scripts/                           setup, dev, syntax and browser checks
stackflow-backend/
  .env.example
  src/
    app.js / server.js             testable Express app + startup
    controllers/                   auth, workspace, projects, milestones, tasks
    routes/                        REST endpoints and permissions
    models/                        existing MongoDB entities + additive fields
    middlewares/                   current-session auth and role checks
    lib/                           validation, sessions, workflow, workspace reads
  test/                            unit and real MongoDB integration checks
stackflow-frontend/
  .env.example
  src/
    components/                    shared UI, forms, task table, search
    context/                       auth and workspace state
    layouts/                       application shell
    pages/                         auth, overview, projects, tasks, review, team
    services/                      typed API operations
    utils/api.ts                   Axios, token refresh and user-safe errors
    lib/                           formatting and class helpers
  public/favicon.svg
docs/STACKFLOW_CONTEXT.md           decisions, compatibility and test status
```

`Progress_SAAS.rtf` is retained for provenance and does not participate in the build. This supplied directory has no Git metadata or submodule entry; initialize Git only after choosing the intended GitHub repository.

## Troubleshooting

- **MongoDB unavailable:** start the MongoDB service and check DB_URI. The API exits clearly rather than serving a broken workspace.
- **npm not recognized:** reopen PowerShell after installing Node. For the default Windows installation, use `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- **Invalid secrets / missing env:** run `npm run setup` for missing files. It preserves existing files; correct existing values manually using the examples. Never commit .env.
- **Port in use:** stop the existing StackFlow terminal before starting another copy. Vite intentionally uses strict port 5173 to keep CORS predictable.
- **EPERM on esbuild.exe during npm ci:** stop the project's running Vite process, then retry. Windows locks running executables.
- **Origin not allowed:** match FRONTEND_URL to the browser origin and restart the backend.
- **403 on a task:** the current database role and milestone assignment are authoritative. Tech Leads review only their own milestones.
- **409 on a task:** another change won or the transition is invalid. Refresh the task and try again.
- **Deletion blocked:** read the dialog's reason. Reviewed/started work is retained. Remove only eligible tasks and empty milestones; do not bypass the checks by deleting database rows manually.
- **Persistent “another project change” error after a crash:** the durable guard deliberately does not expire while a writer might still be running. A database administrator must stop all StackFlow API processes, inspect the affected project's children/references and any interrupted operation, then clear only that project's `mutationToken` before restarting. Normal failures release the guard automatically. Do not clear a guard while any API writer is running.
- **Browser executable missing:** run `npx playwright install chromium`.
- **npm reports install-script approval warnings:** installed prebuilt bcrypt/esbuild binaries worked in the recorded Windows run. If a different machine requires package build scripts, review the named package using your npm version's approval mechanism.
- Browserslist/Baseline may report old compatibility datasets. These are tooling notices, not failed checks.

This is a minimal single-workspace application for small teams. Workspace reads intentionally load that organization's records; very large workspaces would need server-side pagination. Authentication rate limiting is process-local. One refresh session is stored per account. These are explicit scale boundaries, not incomplete workflow steps.

Maintainer: Nidha Ahmed Mohammad. License identifier: ISC.
