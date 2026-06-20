---
id: CONSOLE-007
title: "Claim a scope"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.scopes.tsx
    - apps/web/src/routes/api.scopes.$scope.ts
  tests: []
---

## Description

The scopes page has a claim form: submitting a scope name sends
`PUT /api/scopes/:scope`, making the caller the scope's first admin. Surfaces the
domain outcome (enforces SCOPE claim rules: canonical-name validation, and a
conflict when the scope is already owned by another user).

## Acceptance criteria

### CONSOLE-007-AC1 , Claiming a new scope succeeds and refreshes the list
```gherkin
Given the user enters an unclaimed canonical scope name
When the user submits the claim form
Then PUT /api/scopes/<scope> is sent
And on a 201 the input resets and the scopes list reloads to include the new scope (caller is its admin)
```

### CONSOLE-007-AC2 , Invalid scope name is rejected
```gherkin
Given the user enters a non-canonical scope name
When the claim is submitted
Then the API responds 400
And the form shows the validation error message
```

### CONSOLE-007-AC3 , Claiming an already-owned scope shows a conflict
```gherkin
Given the user enters a scope already owned by another user
When the claim is submitted
Then the API responds 409 (enforces SCOPE claim ownership)
And the form shows the returned conflict message
```
