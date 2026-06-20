# CONSOLE , Developer dashboard

> The signed-in developer console at `/dashboard`: an overview with plugin stats,
> the My plugins list and per-plugin editor (listing metadata + version
> deprecate/yank), scope claim and membership management, the verified publisher
> name, API publish tokens, sign-out, and the public profile editor. This is the
> UI layer over the registry domain: the rules it enforces are specified in
> SCOPE / MANAGE / SOCIAL (the console reuses those services directly over the
> shared D1) and this file specifies the user-facing console behaviour (which
> route renders, what redirects, list/row state, the API status a flow returns)
> and cross-references those domain codes where useful.

Status legend and the code scheme live in [README](./README.md).

---

## CONSOLE-001 , Server-side auth guard and login redirect

- **Status:** [DONE]
- **Area:** Console / auth guard
- **Test mode:** manual (verified in-browser; no console e2e suite yet)
- **Traceability:** `apps/web/src/routes/dashboard.tsx` (layout route), `apps/web/src/lib/require-user.ts` (requireUser) - (no e2e; manual)

The `/dashboard` layout route runs `requireUser` in `beforeLoad`, puts the
signed-in `user` on the route context, and renders `<Outlet/>`. Children inherit
the guard so there is no per-page login flash. Unauthenticated access to any
`/dashboard*` route redirects to GitHub OAuth carrying the original path.

**CONSOLE-001-AC1** , Signed-in user reaches a dashboard route
```gherkin
Given a request with a valid session cookie
When the user navigates to a /dashboard route
Then the matched dashboard page renders
And the signed-in user is available on the route context (no LoginCard flash)
```

**CONSOLE-001-AC2** , Unauthenticated access redirects to GitHub OAuth
```gherkin
Given a request with no valid session cookie
When the user navigates to /dashboard/plugins
Then the response is a 307 redirect to /auth/github
And the redirect carries return=<the requested path> so sign-in lands back there
```

**CONSOLE-001-AC3** , Guard runs once for all children
```gherkin
Given the user is signed in
When the user navigates between dashboard child routes (overview, plugins, scopes, account tokens, profile)
Then each child renders without re-prompting for login
And no child shows a login card before its content
```

---

## CONSOLE-002 , Overview page and plugin stat cards

- **Status:** [DONE]
- **Area:** Console / overview
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.index.tsx` (OverviewPage), `apps/web/src/lib/use-my-plugins.ts` (useMyPlugins) - (no e2e; manual)

`/dashboard` (the index route) renders the Overview: a greeting, four stat cards
derived from the maintainer's plugins (total plugins, weekly downloads, average
rating, verified count), a link to My plugins, and a "Publish from GitHub" guide
with a copyable workflow snippet.

**CONSOLE-002-AC1** , Overview route renders the four stat cards
```gherkin
Given the user is signed in
When the user opens /dashboard
Then the Overview page renders with stat cards labelled Total plugins, Weekly downloads, Avg rating, and Verified
```

**CONSOLE-002-AC2** , Stat cards reflect the maintainer's plugins
```gherkin
Given the maintainer query (maintainer:<login>) returns the user's plugins
When the Overview loads its stats from use-my-plugins
Then Total plugins shows the count of returned plugins
And Weekly downloads, Avg rating, and Verified are computed from those plugins (a dot placeholder when there is nothing to show)
```

**CONSOLE-002-AC3** , Total plugins card links to My plugins
```gherkin
Given the Overview page is rendered
When the user activates the Total plugins card or the Manage my plugins link
Then the app navigates to /dashboard/plugins
```

**CONSOLE-002-AC4** , Publish-from-GitHub snippet is copyable
```gherkin
Given the Overview page is rendered
When the user clicks the copy control on the Publish from GitHub workflow block
Then the workflow YAML is written to the clipboard
And the control shows a copied confirmation state
```

---

## CONSOLE-003 , My plugins list

- **Status:** [DONE]
- **Area:** Console / plugins
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.plugins.index.tsx` (MyPluginsPage), `apps/web/src/lib/use-my-plugins.ts` (useMyPlugins) - (no e2e; manual)

`/dashboard/plugins` lists the plugins the signed-in developer maintains, one row
each, with icon, display name, version, a Published badge, capability count, and
an edit link. An empty state shows when the maintainer has no plugins.

**CONSOLE-003-AC1** , My plugins route renders the table
```gherkin
Given the user is signed in
When the user opens /dashboard/plugins
Then the My plugins page renders a table with column headers Plugin, Status, and Capabilities
```

**CONSOLE-003-AC2** , One row per maintained plugin
```gherkin
Given the maintainer query returns N plugins
When the My plugins table renders
Then it shows N rows
And each row shows the plugin display name, version, a Published badge, and a verified mark when the plugin is verified
```

**CONSOLE-003-AC3** , Empty state when no plugins
```gherkin
Given the maintainer query returns no plugins
When the My plugins table renders
Then it shows the "No published plugins yet" empty state instead of rows
```

**CONSOLE-003-AC4** , Row edit link opens the plugin editor
```gherkin
Given a plugin row is rendered
When the user activates the row edit control
Then the app navigates to /dashboard/plugins/<name>
```

---

## CONSOLE-004 , Plugin editor version management (deprecate / yank)

- **Status:** [DONE]
- **Area:** Console / plugins / versions
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.plugins.$.tsx` (VersionsCard), `apps/web/src/routes/api.plugins.versions.ts`, `api.plugins.deprecate.ts`, `api.plugins.yank.ts` - (no e2e; manual)

The plugin editor at `/dashboard/plugins/<name>` includes a real Versions panel.
It loads the package's versions and a `canManage` flag from
`GET /api/plugins/versions`. Per-version deprecate/un-deprecate and yank/un-yank
hit `POST /api/plugins/deprecate` and `POST /api/plugins/yank`. Mutations are
gated server-side by the domain ownership policy (enforces MANAGE rules), so the
UI buttons are a convenience only.

**CONSOLE-004-AC1** , Versions panel lists each version with state badges
```gherkin
Given the editor is open for a registry-hosted plugin the user can manage
When the Versions panel loads from GET /api/plugins/versions
Then it lists each published version
And each row shows a latest, deprecated, or yanked badge matching that version's state
```

**CONSOLE-004-AC2** , Deprecate a version
```gherkin
Given a manageable, non-deprecated version row
When the user clicks Deprecate
Then POST /api/plugins/deprecate is sent for that name and version
And on a 200 the panel reloads and the version shows the deprecated badge
```

**CONSOLE-004-AC3** , Yank a version
```gherkin
Given a manageable, non-yanked version row
When the user clicks Yank
Then POST /api/plugins/yank is sent with yanked true for that name and version
And on a 200 the panel reloads and the version shows the yanked badge
```

**CONSOLE-004-AC4** , canManage gates the per-version action buttons
```gherkin
Given GET /api/plugins/versions returns canManage false
When the Versions panel renders
Then no deprecate or yank buttons are shown on any version row
And a note explains version management is limited to scopes the user belongs to
```

**CONSOLE-004-AC5** , Non-registry package shows a note instead of controls
```gherkin
Given the editor is open for an npm-hosted (non-registry) package
When GET /api/plugins/versions responds 404
Then the Versions panel shows the "hosted on npm" note instead of a version list
```

**CONSOLE-004-AC6** , Failed mutation surfaces the server error
```gherkin
Given the user clicks Deprecate or Yank on a version
When the API responds with a non-2xx status (e.g. 403 from the ownership policy)
Then the panel shows the returned error message
And the version's state is left unchanged
```

---

## CONSOLE-005 , Plugin listing-metadata editor

- **Status:** [WIP]
- **Area:** Console / plugins / listing metadata
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.plugins.$.tsx` (EditListing) - (no e2e; manual)

The plugin editor also presents the listing-metadata form: icon upload,
per-locale display name / summary / description with a language switcher,
supported-languages and keyword editors, and a public/unlisted visibility toggle.
This capability is a DEMO stub: Save only sets local component state, with no
persistence. Marked [WIP] until a persistence backend exists. (The Versions panel
in the same page, CONSOLE-004, is [DONE].)

**CONSOLE-005-AC1** , Listing editor renders the metadata form
```gherkin
Given the editor is open for a plugin
When the listing page renders
Then it shows the icon, listing details (display name, summary, description), supported languages, keywords, and a visibility toggle
```

**CONSOLE-005-AC2** , Language switcher changes the edited locale
```gherkin
Given the listing editor is rendered with multiple shipped locales
When the user selects a different language in the switcher
Then the form reflects the selected locale and its translated/fallback state banner
```

**CONSOLE-005-AC3** , Save does not yet persist (stub)
```gherkin
Given the user edits listing fields
When the user clicks Save changes
Then the button shows a transient Saved confirmation from local state only
And no metadata is persisted server-side (WIP: persistence not yet built)
```

---

## CONSOLE-006 , Scopes list

- **Status:** [DONE]
- **Area:** Console / scopes
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.scopes.tsx` (ScopesPage, ScopeList), `apps/web/src/routes/api.scopes.ts` (GET) - (no e2e; manual)

`/dashboard/scopes` lists the scopes the signed-in user belongs to, with the
scope name, verified display name (when set), and the user's role, each linking to
the scope detail page. Reads `GET /api/scopes`.

**CONSOLE-006-AC1** , Scopes route lists the user's scopes
```gherkin
Given the user is signed in and belongs to one or more scopes
When the user opens /dashboard/scopes
Then GET /api/scopes is fetched
And each scope is listed with its name and the user's role (admin or member)
```

**CONSOLE-006-AC2** , Empty state when the user belongs to no scope
```gherkin
Given GET /api/scopes returns an empty list
When the scopes list renders
Then it shows the "you don't belong to any scope yet" empty state
```

**CONSOLE-006-AC3** , A scope row links to its detail page
```gherkin
Given a scope row is rendered
When the user activates the row
Then the app navigates to /dashboard/scopes/<scope>
```

---

## CONSOLE-007 , Claim a scope

- **Status:** [DONE]
- **Area:** Console / scopes
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.scopes.tsx` (claim form), `apps/web/src/routes/api.scopes.$scope.ts` (PUT) - (no e2e; manual)

The scopes page has a claim form: submitting a scope name sends
`PUT /api/scopes/:scope`, making the caller the scope's first admin. Surfaces the
domain outcome (enforces SCOPE claim rules: canonical-name validation, and a
conflict when the scope is already owned by another user).

**CONSOLE-007-AC1** , Claiming a new scope succeeds and refreshes the list
```gherkin
Given the user enters an unclaimed canonical scope name
When the user submits the claim form
Then PUT /api/scopes/<scope> is sent
And on a 201 the input resets and the scopes list reloads to include the new scope (caller is its admin)
```

**CONSOLE-007-AC2** , Invalid scope name is rejected
```gherkin
Given the user enters a non-canonical scope name
When the claim is submitted
Then the API responds 400
And the form shows the validation error message
```

**CONSOLE-007-AC3** , Claiming an already-owned scope shows a conflict
```gherkin
Given the user enters a scope already owned by another user
When the claim is submitted
Then the API responds 409 (enforces SCOPE claim ownership)
And the form shows the returned conflict message
```

---

## CONSOLE-008 , Scope members management UI

- **Status:** [DONE]
- **Area:** Console / scopes / members
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.scopes_.$scope.tsx` (ScopeDetailPage, AddMember), `apps/web/src/routes/api.scopes.$scope.members.ts`, `api.scopes.$scope.members.$memberId.ts` - (no e2e; manual)

`/dashboard/scopes/<scope>` lists members and, for admins, lets them add a member,
change a member's role, and remove a member. Admin-only controls are hidden for
non-admin members (who see roles read-only). Enforces SCOPE membership rules
server-side (e.g. cannot demote/remove the last admin surfaces as 409).

**CONSOLE-008-AC1** , Scope detail lists members
```gherkin
Given the user is a member of the scope
When the user opens /dashboard/scopes/<scope>
Then GET /api/scopes/<scope>/members is fetched
And each member is listed with their id and role
```

**CONSOLE-008-AC2** , Admin sees member-management controls
```gherkin
Given the signed-in user is an admin of the scope
When the members list renders
Then each member row shows a role select and a remove control
And an add-member form is shown
```

**CONSOLE-008-AC3** , Non-admin controls are hidden
```gherkin
Given the signed-in user is a non-admin member of the scope
When the members list renders
Then no role select, remove control, or add-member form is shown
And each member's role is displayed read-only
```

**CONSOLE-008-AC4** , Admin adds a member
```gherkin
Given an admin enters a GitHub login and a role in the add-member form
When the form is submitted
Then PUT /api/scopes/<scope>/members is sent with that memberId and role
And on a 200 the input resets and the members list reloads with the new member
```

**CONSOLE-008-AC5** , Admin changes a member's role
```gherkin
Given an admin changes a member's role select
When the change is committed
Then PUT /api/scopes/<scope>/members is sent for that member with the new role
And on a 200 the members list reloads
```

**CONSOLE-008-AC6** , Admin removes a member
```gherkin
Given an admin activates a member's remove control
When the request is sent
Then DELETE /api/scopes/<scope>/members/<memberId> is sent
And on a 200 the members list reloads without that member
```

**CONSOLE-008-AC7** , Last-admin guard surfaces the conflict
```gherkin
Given an admin attempts to remove or demote the scope's last admin
When the request is sent
Then the API responds 409 (enforces SCOPE last-admin rule)
And the page shows the returned error message
```

---

## CONSOLE-009 , Verified display-name editor (admin-only)

- **Status:** [DONE]
- **Area:** Console / scopes / verified name
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.scopes_.$scope.tsx` (DisplayNameCard), `apps/web/src/routes/api.scopes.$scope.display-name.ts` (POST) - (no e2e; manual)

On the scope detail page, admins get a Verified publisher name editor that sets
the trusted name shown on every package in the scope. The card is hidden for
non-admins. Sends `POST /api/scopes/:scope/display-name` (enforces SCOPE verified
display-name rules; blank clears it).

**CONSOLE-009-AC1** , Editor visible only to admins
```gherkin
Given the user opens the scope detail page
When the user is an admin of the scope
Then the Verified publisher name editor is shown
And when the user is a non-admin member, the editor is not shown
```

**CONSOLE-009-AC2** , Admin sets the verified display name
```gherkin
Given an admin enters a display name and submits
When the request is sent
Then POST /api/scopes/<scope>/display-name is sent with the name
And on a 200 the button shows a Saved confirmation
```

**CONSOLE-009-AC3** , Submitting blank clears the verified name
```gherkin
Given an admin clears the display-name field and submits
When the request is sent
Then POST /api/scopes/<scope>/display-name is sent with a null displayName
And on a 200 the verified name is cleared
```

---

## CONSOLE-010 , API tokens list, create-once, and revoke

- **Status:** [DONE]
- **Area:** Console / account / tokens
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.account.tokens.tsx` (TokensPage), `apps/web/src/routes/api.account.tokens.ts`, `api.account.tokens.$hash.ts` - (no e2e; manual)

`/dashboard/account/tokens` lists the user's publish tokens (fingerprint and
dates only; plaintext is never stored), lets the user create a token whose
plaintext is shown exactly once, and revoke a token by its hash. Enforces MANAGE
token rules; revoke is subject-scoped so a user can only revoke their own token.

**CONSOLE-010-AC1** , Tokens route lists the user's tokens
```gherkin
Given the user is signed in
When the user opens /dashboard/account/tokens
Then GET /api/account/tokens is fetched
And each token is listed by its fingerprint with created, expires, and last-used dates
```

**CONSOLE-010-AC2** , Empty state when no tokens
```gherkin
Given GET /api/account/tokens returns an empty list
When the token list renders
Then it shows the "No tokens yet" empty state
```

**CONSOLE-010-AC3** , Creating a token shows the plaintext once
```gherkin
Given the user clicks New token
Then POST /api/account/tokens is sent
And on a 201 the plaintext token is shown once in a copyable panel with a "won't be shown again" warning
And the token list reloads to include the new token's fingerprint
```

**CONSOLE-010-AC4** , Revoking a token removes it from the list
```gherkin
Given a token row is rendered
When the user activates its revoke control
Then DELETE /api/account/tokens/<hash> is sent
And on a 200 the token list reloads without that token
```

---

## CONSOLE-011 , Sign-out

- **Status:** [DONE]
- **Area:** Console / account / session
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.account.tokens.tsx` (sign-out link), `apps/web/src/routes/auth.logout.ts` - (no e2e; manual)

The account tokens page shows the signed-in identity and a Sign out link that
ends the session via `/auth/logout`.

**CONSOLE-011-AC1** , Sign-out link ends the session
```gherkin
Given the user is on /dashboard/account/tokens
When the user activates the Sign out link
Then the browser navigates to /auth/logout
And the session is cleared (a subsequent /dashboard request redirects to sign-in per CONSOLE-001-AC2)
```

---

## CONSOLE-012 , Profile editor

- **Status:** [DONE]
- **Area:** Console / profile
- **Test mode:** manual (verified in-browser)
- **Traceability:** `apps/web/src/routes/dashboard.profile.tsx` (ProfileEditor), `apps/web/src/routes/api.account.profile.ts` (GET, PUT) - (no e2e; manual)

`/dashboard/profile` loads the developer's own public profile and lets them edit
display name, bio, and website. Saves via `PUT /api/account/profile` (enforces
SOCIAL profile rules), then reflects the persisted result.

**CONSOLE-012-AC1** , Profile route loads the current profile
```gherkin
Given the user is signed in
When the user opens /dashboard/profile
Then GET /api/account/profile is fetched
And the editor is populated with the current display name, bio, and website
```

**CONSOLE-012-AC2** , Saving the profile persists and confirms
```gherkin
Given the user edits the display name, bio, or website and submits
When PUT /api/account/profile is sent with the trimmed values
Then on a 200 the editor updates to the persisted profile
And a Saved confirmation is shown
```

**CONSOLE-012-AC3** , Profile links to the public developer page
```gherkin
Given the profile editor is rendered
When the user activates the View public profile link
Then the app navigates to /developers/<id>
```

---

## CONSOLE-013 , Shared-domain authorization over D1 (401 when unauthenticated)

- **Status:** [DONE]
- **Area:** Console / API authorization
- **Test mode:** unit (identity + status mapping); API auth verified in-browser
- **Traceability:** `apps/web/src/lib/console-api.ts` (authed), `apps/web/src/lib/registry-identity.ts` (sessionIdentity), `apps/web/src/lib/http.ts` (scopeStatus/manageStatus) - `apps/web/src/lib/registry-identity.test.ts`, `apps/web/src/lib/http.test.ts`

Every console `api.*` handler runs `authed(request)`: it resolves the session and
builds the registry service graph over the shared D1, mapping the session user to
a GitHub publish identity (`sessionIdentity`), or returns a 401 when there is no
session. Domain `ScopeResult` / `ManageResult` codes map to HTTP via
`scopeStatus` / `manageStatus`.

**CONSOLE-013-AC1** , Unauthenticated console API call returns 401
```gherkin
Given a request to a console api.* endpoint with no valid session
When the handler calls authed(request)
Then the handler returns a 401 JSON "Sign in required" response
And no domain mutation is performed
```

**CONSOLE-013-AC2** , Session maps to a local-actor GitHub publish identity
```gherkin
Given a signed-in session user with login <login>
When sessionIdentity builds the publish identity
Then the identity is provider github, owner <login>, repository null (a local non-CI actor)
```

**CONSOLE-013-AC3** , Domain result codes map to HTTP statuses
```gherkin
Given a ScopeResult or ManageResult error code
When the handler maps it via scopeStatus or manageStatus
Then not_found maps to 404, conflict maps to 409, and forbidden maps to 403
```

---

## CONSOLE-014 , Local-dev registry schema setup (db:setup:local)

- **Status:** [DONE]
- **Area:** Console / operational (local dev)
- **Test mode:** manual (operational script)
- **Traceability:** `apps/web/scripts/apply-registry-schema.ts`, `apps/web/package.json` (db:setup:local script) - (operational; manual)

In production the store and registry share one D1 holding both the store's social
tables and the registry `reg_*` tables. Locally, the store gets its own miniflare
D1 with only the store's migrations, so the `reg_*` tables the console reads/writes
(scopes, members, tokens, versions) are missing and authenticated console routes
fail. `bun run db:setup:local` applies `packages/db/drizzle` to the local D1
idempotently.

**CONSOLE-014-AC1** , db:setup:local applies the reg_* schema locally
```gherkin
Given a local dev D1 created by the dev server without the reg_* tables
When the developer runs bun run db:setup:local
Then the packages/db/drizzle migrations are applied to the local store D1
And the reg_* tables (scopes, members, tokens, versions) exist afterward
```

**CONSOLE-014-AC2** , The setup is idempotent
```gherkin
Given the local D1 already contains the reg_* schema
When the developer re-runs bun run db:setup:local
Then it no-ops (reports the schema is already present) and exits successfully
```

**CONSOLE-014-AC3** , Missing local D1 is reported clearly
```gherkin
Given no local D1 file exists yet
When the developer runs bun run db:setup:local
Then the script exits non-zero with a message to start the dev server once first
```
