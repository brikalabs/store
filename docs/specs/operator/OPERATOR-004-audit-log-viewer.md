---
id: OPERATOR-004
title: "Operator audit-log viewer"
status: done
area: operator
group: operator
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api/operator/audit.ts
    - apps/web/src/routes/operator/audit.tsx
  tests: []
---

## Description

Operators can read the append-only audit log (HARDEN-008) from the console: a paged
view, newest first, optionally narrowed to a single action type, with the distinct
action list returned for the type filter. Operator-gated.

## Acceptance criteria

### OPERATOR-004-AC1 , the log is paged newest first
```gherkin
Given an operator
When they GET /api/operator/audit
Then a page of audit entries is returned newest first
And the page size is clamped to [1, 100]
```

### OPERATOR-004-AC2 , the log can be filtered by action type
```gherkin
Given an operator
When they GET /api/operator/audit with an action parameter
Then only entries of that action type are returned
And the response includes the distinct action list for the filter
```

### OPERATOR-004-AC3 , the log is hidden from non-operators
```gherkin
Given a request that is not an authenticated operator
When it GETs /api/operator/audit
Then the response is 404
```
