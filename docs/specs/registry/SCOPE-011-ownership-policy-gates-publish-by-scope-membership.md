---
id: SCOPE-011
title: "Ownership policy gates publish by scope membership"
status: gone
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/db/src/adapters/d1-ownership.ts
  tests:
    - packages/db/src/adapters/d1-ownership.test.ts
---

## Description

> **Superseded by the ORG-\* specs** (the organisation rename; see [ADR 0001](../../adr/0001-organisation-1n-model.md)). Retained for history; behaviour now lives under `ORG-*`.

Publishing is authorized against the package's scope: only a member of that scope (any
role) may publish under it, anchored on the verified credential. The policy never claims a
scope implicitly, and distinguishes an unknown scope (create it first) from a real scope
the caller has no membership in.

## Acceptance criteria

### SCOPE-011-AC1 , A member of the scope may publish under it
```gherkin
Given the scope @acme has member bob
And the caller's verified identity is provider=github owner=bob
When canPublish is checked for @acme/widget
Then the result is ok true
```

### SCOPE-011-AC2 , A non-member of an existing scope may not publish
```gherkin
Given the scope @acme exists and the caller is not a member
And the caller's verified identity is provider=github owner=carol
When canPublish is checked for @acme/widget
Then the result is ok false
And the message states the caller is not a member of @acme
```

### SCOPE-011-AC3 , Publishing under an unknown scope is refused (create it first)
```gherkin
Given no reg_scopes row exists for @ghost
And the caller's verified identity is provider=github owner=alice
When canPublish is checked for @ghost/widget
Then the result is ok false
And the message states scope @ghost does not exist; create it first
And no reg_scopes row is created for @ghost
```

### SCOPE-011-AC4 , An unscoped package name cannot be published
```gherkin
Given the caller's verified identity is provider=github owner=alice
When canPublish is checked for the unscoped name "widget"
Then the result is ok false
And the message states only scoped packages (@scope/name) can be published
```
