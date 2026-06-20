---
id: HARDEN-009
title: "Audit writes are best-effort and never fail a committed action"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - packages/db/src/adapters/d1-audit.ts
  tests:
    - packages/db/src/adapters/d1-audit.test.ts
---

## Description

The audit write runs after the action it records has already committed (a published
tarball, a flipped flag). A failed audit write is logged and swallowed: it must never
throw back and turn a successful action into a 500, which the client would read as
failure and then fail to retry against the immutability guard.

## Acceptance criteria

### HARDEN-009-AC1 , A failing audit write does not surface to the caller
```gherkin
Given a mutating action has already committed
And the reg_audit insert throws (a write failure)
When the audit record call runs
Then the error is swallowed (logged, not rethrown)
And the action's response remains its committed success status, not a 500
```
