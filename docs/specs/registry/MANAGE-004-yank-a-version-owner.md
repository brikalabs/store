---
id: MANAGE-004
title: "Yank a version (owner)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/manage.ts
    - apps/registry/src/controllers/manage.ts
  tests:
    - packages/registry-core/src/manage.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

A scope member yanks a version to hide it from new installs and the catalog. The tarball
bytes are kept, so a lockfile that already pins the yanked version still resolves. The
endpoint requires a write credential whose identity owns the scope.

## Acceptance criteria

### MANAGE-004-AC1 , An owner yanks a version and it disappears from new installs
```gherkin
Given an existing version name@version owned by the authenticated caller
When the caller POSTs /-/package/:name/:version/yank with { yanked: true }
Then the result is ok and the endpoint responds 200
And reading the packument no longer lists the version in its "versions" map
And the catalog no longer surfaces the version
```

### MANAGE-004-AC2 , A pinned lockfile still resolves a yanked version
```gherkin
Given a version that has been yanked
And the tarball bytes for that version still exist in storage
When a client requests the exact yanked version by its pinned tarball path
Then the tarball is served as normal (the bytes are not deleted on yank)
```
