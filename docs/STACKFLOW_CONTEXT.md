# StackFlow — maintainer context

Last updated: 2026-10-26. Read the root README for setup, configuration, commands and role permissions.

## Product and implementation

Minimal MERN workspace: authentication, organization membership, project/milestone planning, assigned tasks, human review, team management and scoped search. All major screens share warm neutral surfaces, a charcoal sidebar, restrained green accents, compact lists/tables and accessible dialogs. No mock responses, decorative analytics, unused navigation or Redis dependency.

The existing React/TypeScript/Vite and Express/Mongoose architecture remains. Backend dependencies and commands live in the root package; frontend dependencies live in `stackflow-frontend`. `src/app.js` builds the testable API; `src/server.js` loads the backend environment, validates configuration, connects MongoDB and starts listening. `scripts/dev.mjs` runs both services, with Vite's working directory set to the frontend so Tailwind configuration resolves correctly.

Frontend API calls are in `services/workspace.ts`; `utils/api.ts` owns memory-only access tokens and a shared refresh retry. Auth and workspace contexts supply the shell/pages. Shared work forms, a task table, task panel and command palette cover repeated interactions. Search supports keyboard navigation, focus containment and direct links. The workspace refreshes after writes, on window focus and every 30 seconds while visible.

## Workflow contract

The transition contract was established before replacing the unsafe worker/transition implementation. Existing persisted `pending`, `completed` and `verified` values remain valid. Added states are `in_progress` and `changes_requested`.

| Action | From | To | Allowed actor |
| --- | --- | --- | --- |
| start | pending, changes_requested | in_progress | Assigned Teammate |
| complete | pending, in_progress, changes_requested | completed | Assigned Teammate |
| undo-complete | completed | in_progress | Assigned Teammate |
| verify | completed | verified | Assigned milestone Tech Lead or Admin |
| reject | completed | changes_requested | Assigned milestone Tech Lead or Admin; reason required |
| unverify | verified | completed | Assigned milestone Tech Lead or Admin; reason required |

`completed` appears as **In review** in the UI. Nobody is automatically verified. Every task transition records actor, time, source/destination and reason in the same atomic MongoDB update as the new state. Conditional status/version writes reject duplicate or stale changes with 409. Metadata edits also use versions. Tasks can be edited only in active states; only pending tasks can be deleted.

`lib/workflow.js` centralizes transitions/permissions/progress. `lib/workspace.js` scopes all records to the current organization and valid project/milestone hierarchy, enriches read data and derives progress from actual tasks. Both milestone and project progress are verified/total tasks, rounded; empty work is 0%. Project progress is task weighted. Historical reference arrays and cached progress remain compatible but are not authoritative. New task fields/history are additive. Dates retain the chosen calendar date.

## Authorization and sessions

- Current membership, role and session version are read from MongoDB on each authenticated request. Every object operation checks its organization/hierarchy; a Tech Lead can manage/review only assigned milestones. Browser controls mirror these rules but are not relied on for enforcement.
- Workspace creators are Admins. Invite registrations join as Teammates; only Admins grant Tech Lead access. Admins create/edit projects. Admins or Tech Leads create milestones; Tech Leads can assign only themselves. Admins can edit/reassign milestones.
- Member removal, leave and role changes check unfinished task/milestone ownership. Admins remain workspace owners. Removed users lose their session immediately; rejoining assigns the Teammate role.
- HS256 access tokens last 15 minutes; refresh cookies last seven days, HttpOnly/SameSite=Lax with `/api/auth` path and Secure in production. Refresh claims include current organization and role. Tokens are hashed in MongoDB; existing legacy tokens remain compatible. Logout clears current/legacy cookie paths and revokes access. Login replaces the previous session. Emails are normalized on new writes; case-insensitive lookups preserve older mixed-case accounts.
- Configuration rejects missing/placeholder/equal JWT secrets. Production requires 32+ characters, development accepts existing 24+ character secrets. `npm run setup` creates missing environments using random secrets and never overwrites existing files. Real configuration and secrets were preserved and are ignored by Git.
- Explicit CORS origins, rejected foreign browser origins, bounded JSON requests, typed input validation, sanitized errors and a small process-local auth limiter replace unsafe defaults. Logs do not expose connection strings or credentials.

## Cleanup and compatibility

Removed the BullMQ/Redis queue clients and automatic task verifier; `/api/queue/pending` and stats now query MongoDB. `/api/queue/failed` explicitly returns 410. Removed unused auth/organization middleware, abandoned model script, duplicate auth/create-modal pages, unused UI wrappers/assets, generated TypeScript config outputs and obsolete dependencies. Replaced duplicate frontend README with the root instructions. Kept Radix dialogs/buttons, Tailwind, Lucide and the existing MERN dependencies.

Historical `StackFlow` directory and `Progress_SAAS.rtf` remain untouched. Existing valid data was not reset or seeded. Test fixtures use separate disposable databases. The supplied directory had no Git metadata during the 2026-10-26 pass; `.artifacts/quality-baseline` preserves source before this pass (excluding environment files/dependencies) for comparison. Git was not reinitialized.

## Lifecycle and profile completion (2026-10-26)

- Admin-only `DELETE /api/projects/:projectId` and `DELETE /api/milestones/:milestoneId` require exact name confirmation and a current version. Projects must have no milestones; milestones must have no tasks. No cascade discards work/history. Unstarted tasks are removed individually; task deletion also rejects legacy pending records with submission/review history. UI confirmations show the target, require its name, disable repeated submissions, retain a version snapshot, and reload/navigate after success.
- `lib/lifecycle.js` uses an atomic durable project mutation token to serialize creation, deletion and hierarchy metadata edits across processes. Transactions with snapshot reads and majority writes are used on replica sets/sharded clusters. On standalone MongoDB, operation ordering plus this guard prevents parent/child orphan races. The reverse projectId/milestoneId relations remain authoritative if optional legacy reference maintenance is interrupted. The guard is hidden from API payloads. It deliberately fails closed after process termination: stop all API writers, inspect/repair the interrupted operation, and clear only the affected guard before restart. Never expire it automatically while a writer could remain active.
- Profile is reachable from the sidebar user identity at `/profile`, including without workspace membership. `PATCH /api/auth/profile` permits only name changes. Email, role and ownership remain read-only. `POST /api/auth/password` verifies the current password, enforces the existing bcrypt limits, hashes at cost 12, and atomically revokes all sessions. Session issuance/profile updates use version checks to avoid reviving revoked sessions through concurrent requests. Both responses omit password/session storage fields. Sign-in displays a password-change confirmation.
- UI refinements: larger task-table text, consistent wrapping actions, account form sections, return focus after dialogs close, keyboard project tabs, explicit links to all milestone tasks, working Cancel with no eligible assignees, and busy-state protection for dialogs.

## Verification

Windows, Node 24.21, npm 11.19, MongoDB 8.3; Chromium installed by Playwright. Both lockfiles install with `npm ci`. The following checks are reproducible from the root:

- `npm run check:backend`: syntax checks for all backend JS.
- `npm run typecheck`, `npm run lint`, `npm run build`: frontend checks and production bundle.
- Root/frontend `npm audit`: zero vulnerabilities after compatible lockfile updates. Frontend overrides `postcss-selector-parser` to `^7.1.6` for Tailwind 3/postcss-nested; keep this until their dependency ranges include the fix. Build/browser checks validate the override. No forced Tailwind major upgrade.
- `npm test`: 10 unit checks for transition matrices, permissions, reasons, progress and date validation.
- `npm run test:integration`: 21 scenarios plus the parent test (22 reported tests). Covers the original workflow plus empty deletion, stale/duplicate confirmation, cross-tenant deletion, history retention, concurrent child creation/deletion, failed-closed gates, profile field restrictions and password/session revocation. `npm run test:transactions` passes the same suite on a disposable replica set; standalone MongoDB is also covered.
- `npm run test:browser`: real Chromium workflow from UI registration through project/milestone/task creation, all three roles, rejection/resubmission/verification, persistence after reload, progress, keyboard search/focus trap, deep links, refresh recovery, filters, due dates, responsive routes and recoverable server failure. Screenshots are ignored under `.artifacts/browser/`.

The expanded browser suite also covers project/milestone/task edits, blocked and successful deletion, confirmation cancellation/focus, deleted deep links, profile save/cancel/persistence, wrong-current-password feedback and successful password change/sign-in. Profile joins the desktop/tablet/mobile route checks. The 2026-10-26 audit attempts failed with npm registry connection resets; earlier zero-vulnerability results are historical, not a fresh security assertion.

Integration/browser scripts create unique databases with guarded cleanup; they do not load the real application environment. They require MongoDB, and the browser suite also requires Chromium and free port 5175. The development application uses ports 5173 and 5000. All test databases created by successful runs are dropped.

## Deliberate limits

This is a small-team application with one organization per account and one refresh session per account. Workspace reads load that organization's records; UI task lists paginate locally. Large datasets would need server pagination. Authentication rate limiting is process-local. Production hosting, TLS and external database administration remain deployment responsibilities. There is no external service blocker for the verified local workflow.
