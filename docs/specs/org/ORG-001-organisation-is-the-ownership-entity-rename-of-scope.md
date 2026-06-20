---
id: ORG-001
title: "Organisation is the ownership entity (rename of \"scope\")"
status: todo
area: org
group: org
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

The membership/ownership entity is named **organisation** across domain, storage,
registry management API, and console. The word "scope" is retained ONLY for the
npm namespace string an org owns (resolve/publish/packument/`isCanonicalScope`),
which is npm protocol.

## Acceptance criteria

### ORG-001-AC1 , org owns a scope
```gherkin
Given an organisation "brika"
When I read its record
Then it owns the npm scope "@brika"
And packages published under "@brika" are governed by org "brika" membership
```

### ORG-001-AC2 , npm read surface is unchanged by the rename
```gherkin
Given the rename has shipped
When a client runs "bun add @brika/plugin-x"
Then the packument and tarball resolve exactly as before
And no client-visible npm path changed from "scope" to "org"
```

### ORG-001-AC3 , management API moves to /-/org
```gherkin
Given the rename has shipped
When an authenticated client manages an org
Then it uses "/-/org/:org" endpoints
And the prior "SCOPE-*" ownership behaviour is preserved under the new names
```
