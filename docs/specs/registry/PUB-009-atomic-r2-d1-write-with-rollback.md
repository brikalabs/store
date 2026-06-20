---
id: PUB-009
title: "Atomic R2 + D1 write with rollback"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/publish.ts
    - apps/registry/src/controllers/publish.ts
  tests:
    - packages/registry-core/src/publish.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

The only step that writes. The tarball is staged to R2 first, then the version metadata is
committed atomically to D1 inside a transaction. A failed metadata commit rolls the staged
tarball back, so a publish is all-or-nothing across both stores.

## Acceptance criteria

### PUB-009-AC1 , A successful publish stores the tarball and commits the version metadata
```gherkin
Given a publish that has passed every gate
When the package is published
Then the tarball is written to R2 at the version's tarball path
And the version metadata is committed to D1 (the version row and its "latest" tag together)
And the endpoint responds 201 with { ok: true, name, version, integrity }
```

### PUB-009-AC2 , A failed metadata commit rolls back the staged tarball
```gherkin
Given the tarball has been staged to R2 and the metadata commit then fails
When the publish transaction unwinds
Then the staged tarball is removed from R2
And no version metadata is left in D1
And the publish does not report success
```

### PUB-009-AC3 , Metadata commit is all-or-nothing
```gherkin
Given a publish whose metadata commit is interrupted partway
When the commit fails
Then a version row never exists without its "latest" tag, nor a tag without its version row
```
