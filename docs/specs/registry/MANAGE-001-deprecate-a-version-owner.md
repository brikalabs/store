---
id: MANAGE-001
title: "Deprecate a version (owner)"
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

A scope member marks a version as deprecated with a human message (max 1024 chars, or
null to clear). Deprecation is advisory only: the version stays in the packument and stays
installable. The endpoint requires a write credential whose identity owns the scope.

## Acceptance criteria

### MANAGE-001-AC1 , An owner deprecates a version with a message
```gherkin
Given an existing version name@version owned by the authenticated caller
When the caller POSTs /-/package/:name/:version/deprecate with { message: "<text>" }
Then the result is ok and the endpoint responds 200
And reading the packument shows the version with its "deprecated" field set to the message
```

### MANAGE-001-AC2 , A deprecation message over 1024 chars is truncated
```gherkin
Given an existing version owned by the caller
When the caller deprecates it with a message longer than 1024 characters
Then the stored deprecation message is truncated to 1024 characters
```
