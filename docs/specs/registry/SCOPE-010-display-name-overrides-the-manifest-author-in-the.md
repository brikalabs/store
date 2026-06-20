---
id: SCOPE-010
title: "Display name overrides the manifest author in the packument"
status: done
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/db/src/adapters/d1-metadata.ts
    - packages/registry-core/src/packument.ts
  tests:
    - packages/registry-core/src/scope.test.ts
---

## Description

When a package's scope has a verified display name, the packument surfaces it as the
trusted `publisher` (name + verified: true), overriding whatever the manifest `author`
claims. When the scope has no display name the publisher name falls back to the scope owner's id.

## Acceptance criteria

### SCOPE-010-AC1 , The packument publisher uses the scope's verified display name
```gherkin
Given the scope @acme has ownerId=alice and displayName="Acme Corporation"
And a package @acme/widget exists whose manifest author is "Someone Else"
When the packument for @acme/widget is built
Then the packument publisher.name is "Acme Corporation"
And the packument publisher.verified is true
```

### SCOPE-010-AC2 , Without a display name the publisher falls back to the owner id
```gherkin
Given the scope @acme has ownerId=alice and displayName null
And a package @acme/widget exists
When the packument for @acme/widget is built
Then the packument publisher.name is "alice"
And the packument publisher.verified is true
```
