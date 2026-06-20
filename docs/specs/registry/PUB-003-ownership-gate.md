---
id: PUB-003
title: "Ownership gate"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/publish.ts
  tests:
    - packages/registry-core/src/publish.test.ts
---

## Description

After the name is valid, the resolved identity must be allowed to publish this package
(scope owner or member). This runs before the size, data, and storage steps.

## Acceptance criteria

### PUB-003-AC1 , Identity that may not publish the package is forbidden
```gherkin
Given a valid name and a manifest that matches it
And an authenticated identity that OwnershipPolicy.canPublish rejects for that name
When the package is published
Then the publish result is not ok with code "forbidden"
And the endpoint responds 403
And no tarball is written and no version metadata is committed
```

### PUB-003-AC2 , Owning identity passes the ownership gate
```gherkin
Given an authenticated identity that OwnershipPolicy.canPublish accepts for the name
When the package is published
Then the ownership gate passes and evaluation proceeds to the next gate
```
