<div align="center">

# StackFlow

### Plan with clarity. Deliver with ownership. Verify real progress.

A focused, full-stack workspace that brings projects, milestones, task ownership, and human verification together—so teams can see what is actually done, not just what is marked complete.

<br />

[ **↗ OPEN STACKFLOW LIVE** ](https://stackflow-frontend-phi.vercel.app)

<br />

<img alt="React" src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
<img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white">
<img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white">
<img alt="Express" src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white">
<img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white">

<br /><br />

**React · TypeScript · Express · MongoDB · Vercel · Render**

</div>

---

## Built for work that needs to be verified

Teams need more than a list of tasks. They need clear ownership, meaningful milestones, and a reliable way to decide whether work is actually complete.

StackFlow provides a structured workflow:

1. Create a workspace and establish team roles.
2. Organize work into projects and milestones.
3. Assign tasks to teammates with priorities and due dates.
4. Submit completed work for review.
5. Verify the result or request changes with a reason.
6. Track progress based on verified tasks and preserve an activity history.

## What you can do

- **Workspace and team management** — create a workspace, invite members, and manage roles.
- **Role-based access** — Admin, Tech Lead, and Teammate permissions are enforced by the backend.
- **Project and milestone planning** — organize outcomes, owners, and deadlines.
- **Task assignment** — track assignees, priorities, due dates, and task states.
- **Human verification** — reviewers verify completed work or request changes with a reason.
- **Progress based on verified work** — submitted work does not count as verified progress.
- **Task history** — record important task transitions and review actions.
- **Search and navigation** — search projects, milestones, tasks, and people; use `Ctrl/Cmd + K` for quick search.
- **Filtering and sorting** — find work by status and priority, with pagination for task tables.
- **Profile and password management** — update your display name or change your password.
- **Responsive interface** — layouts support desktop, tablet, and mobile screens.
- **Session security** — short-lived access tokens, HttpOnly refresh cookies, session revocation, and hashed refresh-token storage.
- **Careful deletion rules** — empty projects and milestones can be deleted by an Admin; started work and review history are protected.

## How the workflow works

### Roles

| Capability | Admin | Tech Lead | Teammate |
| --- | --- | --- | --- |
| View workspace projects, tasks, members, and search | Yes | Yes | Yes |
| Create or edit projects | Yes | No | No |
| Create milestones | Yes | Within assigned role rules | No |
| Edit or reassign milestones | Yes | No | No |
| Create, edit, and assign tasks | Yes | Within own milestones | No |
| Start and submit assigned work | No | No | Own tasks |
| Verify work or request changes | Yes | Own milestones | No |
| Invite/remove members and grant Tech Lead role | Yes | No | No |
| Delete eligible empty projects/milestones | Yes | No | No |

The backend checks the current membership, role, and relevant workspace relationships. Hiding a button in the frontend is not the security boundary.

### Task lifecycle

```text
pending → in_progress → completed → verified
   │                         │
   └──────→ completed        └→ changes_requested
                                      │
                                      └→ in_progress → completed
```

- `completed` is displayed as **In review**.
- Only `verified` tasks count toward verified progress.
- Reviewers must provide a reason when requesting changes or reopening verified work.
- Task state changes and their history are written together, with version checks to reject stale or duplicate actions.

**Progress calculation:** verified tasks ÷ total tasks, rounded to a whole percentage. A project’s progress is weighted across its tasks. Empty projects report 0%.

## Under the hood

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| UI and styling | Tailwind CSS, Radix UI, Lucide |
| Backend | Node.js, Express |
| Database and models | MongoDB, Mongoose |
| Authentication | Signed access tokens, HttpOnly refresh cookies, hashed refresh-token storage |
| Testing | Unit tests, HTTP/MongoDB integration tests, Playwright browser tests |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Database hosting | MongoDB Atlas |

## How it fits together

```text
Browser
   │
   ▼
Vercel — React/Vite production frontend
   │  Same-origin /api requests
   ▼
Render — Express REST API
   │
   ▼
MongoDB Atlas — persistent application data
```

The frontend sends API requests to `/api`. Vercel rewrites those requests to the Render backend. The backend validates input, enforces permissions, performs application logic, and reads or writes data through Mongoose.

The browser does not connect directly to MongoDB. Database credentials and token-signing secrets stay in the backend environment.

## Run it locally

### Prerequisites

- Node.js 22.12+ (Node.js 24 LTS recommended)
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas URI for development

### 1. Clone the repository

```powershell
git clone https://github.com/buildsbyShlok/StackFlow.git
cd StackFlow
```

### 2. Install dependencies

```powershell
npm ci
npm --prefix stackflow-frontend ci
```

### 3. Create local environment files

```powershell
npm run setup
```

The setup command creates missing environment files with local defaults and independently generated JWT secrets. It does not overwrite existing `.env` files or print secret values. Review any existing environment configuration before starting.

### 4. Start MongoDB

If using MongoDB Community Server as a Windows service, check its status:

```powershell
Get-Service MongoDB
```

If it is installed but stopped, start it from an Administrator PowerShell:

```powershell
Start-Service MongoDB
```

Alternatively, use an existing MongoDB data directory with `mongod`, or configure an Atlas connection in `stackflow-backend/.env`.

### 5. Start the application

From the repository root:

```powershell
npm run dev
```

This starts the backend and Vite frontend together. Keep the terminal open while developing; `Ctrl+C` stops the processes.

- **Frontend:** http://localhost:5173
- **API health:** http://localhost:5000/api/health
- **Registration:** http://localhost:5173/register

Use `localhost` consistently rather than mixing it with `127.0.0.1`, so browser origin and cookie settings match.

To run services separately, use two terminals from the repository root:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

`npm start` starts the API without development watching. `npm run build` builds the frontend into `stackflow-frontend/dist`; it does not deploy the application.

## Environment configuration

The backend loads `stackflow-backend/.env` in development. In production, it reads environment variables supplied by the hosting service. Frontend development configuration lives in `stackflow-frontend/.env`.

| Variable | Purpose |
| --- | --- |
| `DB_URI` | MongoDB connection URI |
| `PORT` | API port; defaults to `5000` locally |
| `FRONTEND_URL` | Exact allowed frontend origin(s), comma-separated if needed |
| `ACCESS_SECRET` | Independent secret for signing access tokens |
| `REFRESH_SECRET` | Different independent secret for refresh tokens |
| `NODE_ENV` | Set to `production` by the hosting environment |
| `TRUST_PROXY` | Proxy trust setting; configure for the actual hosting topology |
| `VITE_API_BASE_URL` | Development API origin; the client appends `/api` |
| `BACKEND_URL` | Vercel routing configuration, if using the environment-based route configuration |

Production configuration requires HTTPS, distinct random access/refresh secrets of at least 32 characters, an exact `FRONTEND_URL` origin, and a verified TLS-enabled MongoDB Atlas `mongodb+srv` URI with an explicit application database.

**Never commit `.env` files, credentials, database URIs, token secrets, or real user data.** Do not place private backend secrets in frontend variables prefixed with `VITE_`; those values may be included in the browser bundle.

## Deployment

StackFlow is deployed as three services:

1. **Vercel** builds and serves the React frontend.
2. **Render** runs the Express API.
3. **MongoDB Atlas** hosts persistent database records.

Deployment configuration is included in the repository:

- `render.yaml` — Render service configuration.
- `stackflow-frontend/vercel.json` — frontend build/routing configuration.

These files describe configuration; they do not create cloud services or deploy by themselves. Configure service settings and environment variables in the relevant dashboards. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full deployment checklist.

After deployment, verify the frontend, `/api/health`, registration, login, session refresh/logout, and database persistence. A successful health response confirms that the health route responds; it does not by itself prove database connectivity or authentication correctness.

## Testing and quality checks

Run commands from the repository root.

```powershell
npm run typecheck
npm run lint
npm run check:backend
npm test
npm run test:integration
npm run build
```

Run dependency audits when the npm registry is available:

```powershell
npm audit
npm --prefix stackflow-frontend audit
```

For browser tests, install Chromium once:

```powershell
npx playwright install chromium
npm run test:browser
```

For integration tests against a disposable local MongoDB replica set:

```powershell
npm run test:transactions
```

Test notes:

- `npm test` covers transitions, permissions, deadlines, progress, configuration, CORS, and cookie behavior without requiring the application database.
- `npm run test:integration` exercises real HTTP/MongoDB flows including authentication, refresh/logout, workspace isolation, assignment, review, concurrency, progress, search, and membership.
- `npm run test:browser` covers workflows across roles, responsive layouts, session recovery, keyboard search, and error recovery.
- Integration and browser suites create their own test databases and remove only those test databases during cleanup. They do not load the application's real `.env`.
- `npm run test:transactions` requires `mongod`; see the project documentation for the binary path and `MONGOD_BINARY` override.

Previously recorded checks passed for type checking, lint, backend syntax, unit tests, integration tests, browser workflows, and production build. The latest recorded dependency-audit attempt could not refresh results because the npm registry connection reset, so that run did not establish current vulnerability status.

## Security and data integrity

- Passwords should be stored as hashes, never plaintext.
- Access tokens are short-lived and held in browser memory.
- Refresh tokens use an HttpOnly cookie and are stored hashed in the database.
- Logout revokes the current session and clears refresh cookies.
- Password changes revoke active sessions.
- The backend checks organization membership and role on protected operations.
- Task transitions use conditional version/status updates to prevent stale or duplicate changes.
- Project and milestone deletion is restricted to eligible empty records; destructive cascades are intentionally avoided.
- Secrets belong in environment configuration, not source control.

## Current scope

StackFlow is designed as a focused workspace for small teams. Workspace reads load the organization's records, so very large workspaces would benefit from server-side pagination. Authentication rate limiting is process-local, and one refresh session is stored per account. These are current scale boundaries to consider before expanding to a larger deployment.

## Repository structure

```text
StackFlow/
├── package.json
├── package-lock.json
├── render.yaml
├── scripts/
├── stackflow-backend/
│   ├── .env.example
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── controllers/
│       ├── routes/
│       ├── models/
│       ├── middlewares/
│       └── lib/
├── stackflow-frontend/
│   ├── .env.example
│   ├── vercel.json
│   └── src/
│       ├── components/
│       ├── context/
│       ├── layouts/
│       ├── pages/
│       ├── services/
│       └── utils/
└── docs/
    └── DEPLOYMENT.md
```

## Contributing

Issues, suggestions, and improvements are welcome. For changes, create a branch, keep secrets and local data out of commits, run the relevant checks, and open a pull request with a concise explanation of the change.

## License

ISC
