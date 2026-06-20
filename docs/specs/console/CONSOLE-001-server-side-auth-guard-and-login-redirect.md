---
id: CONSOLE-001
title: "Server-side auth guard and login redirect"
status: done
area: console
group: console
test_mode: manual (verified in-browser; no console e2e suite yet)
traceability:
  code:
    - apps/web/src/routes/dashboard.tsx
    - apps/web/src/lib/require-user.ts
  tests: []
---

## Description

The `/dashboard` layout route runs `requireUser` in `beforeLoad`, puts the
signed-in `user` on the route context, and renders `<Outlet/>`. Children inherit
the guard so there is no per-page login flash. Unauthenticated access to any
`/dashboard*` route redirects to GitHub OAuth carrying the original path.

## Acceptance criteria

### CONSOLE-001-AC1 , Signed-in user reaches a dashboard route
```gherkin
Given a request with a valid session cookie
When the user navigates to a /dashboard route
Then the matched dashboard page renders
And the signed-in user is available on the route context (no LoginCard flash)
```

### CONSOLE-001-AC2 , Unauthenticated access redirects to GitHub OAuth
```gherkin
Given a request with no valid session cookie
When the user navigates to /dashboard/plugins
Then the response is a 307 redirect to /auth/github
And the redirect carries return=<the requested path> so sign-in lands back there
```

### CONSOLE-001-AC3 , Guard runs once for all children
```gherkin
Given the user is signed in
When the user navigates between dashboard child routes (overview, plugins, scopes, account tokens, profile)
Then each child renders without re-prompting for login
And no child shows a login card before its content
```
