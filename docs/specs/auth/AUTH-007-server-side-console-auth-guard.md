---
id: AUTH-007
title: "Server-side console auth guard"
status: done
area: auth
group: auth
test_mode: manual
traceability:
  code:
    - apps/web/src/lib/require-user.ts
    - apps/web/src/routes/dashboard.tsx
  tests: []
---

## Description

The console (`/dashboard` and its children) is gated server-side in the `/dashboard`
`beforeLoad`. An unauthenticated visit throws a redirect to GitHub OAuth carrying an encoded
`?return=`, before any client render, so there is no LoginCard flash. The resolved user is
placed on the route context and inherited by every child route. Verified in-browser:
unauthenticated `/dashboard/scopes` returns 307 to
`/auth/github?return=%2Fdashboard%2Fscopes`.

## Acceptance criteria

### AUTH-007-AC1 , Unauthenticated console access redirects to sign-in carrying the return path
```gherkin
Given a visitor with no valid session navigates to /dashboard/scopes
When the /dashboard beforeLoad guard runs
Then the navigation is redirected to /auth/github?return=%2Fdashboard%2Fscopes
And no console UI (and no login-card flash) is rendered before the redirect
```

### AUTH-007-AC2 , Authenticated console access renders with the user on context
```gherkin
Given a visitor with a valid session navigates to a /dashboard route
When the guard runs
Then no redirect occurs
And the signed-in user is available on the route context to the child route
```

### AUTH-007-AC3 , After sign-in the visitor returns to the originally requested path
```gherkin
Given an unauthenticated visit to /dashboard/scopes was redirected to sign-in
When the visitor completes GitHub OAuth
Then the OAuth callback redirects them to /dashboard/scopes
```
