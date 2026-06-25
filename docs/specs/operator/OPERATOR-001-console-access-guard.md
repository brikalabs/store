---
id: OPERATOR-001
title: "Operator console access guard"
status: done
area: operator
group: operator
test_mode: unit
traceability:
  code:
    - apps/web/src/server/require-operator.ts
    - apps/web/src/routes/operator.tsx
  tests: []
---

## Description

`/operator` is the moderation console, gated to registry operators (the
`REGISTRY_ADMINS` allowlist, resolved server-side against the session identity).
The guard returns `notFound()` (404) for everyone else, rather than 403 or a
redirect, so the console's existence is not advertised to non-operators.

## Acceptance criteria

### OPERATOR-001-AC1 , an operator reaches the console
```gherkin
Given a signed-in user whose identity is in the operator allowlist
When they open /operator
Then the moderation console loads
```

### OPERATOR-001-AC2 , a signed-in non-operator gets a 404
```gherkin
Given a signed-in user who is not in the operator allowlist
When they open /operator
Then the response is 404 (not 403 and not a redirect)
```

### OPERATOR-001-AC3 , a signed-out visitor gets a 404
```gherkin
Given no signed-in session
When the request hits /operator
Then the response is 404
```

### OPERATOR-001-AC4 , operator API endpoints enforce the same gate
```gherkin
Given a request that is not an authenticated operator
When it calls any /api/operator/* endpoint
Then the response is 404
```
