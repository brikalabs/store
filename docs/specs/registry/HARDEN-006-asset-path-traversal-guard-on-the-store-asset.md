---
id: HARDEN-006
title: "Asset path-traversal guard on the store asset endpoint"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - apps/web/src/lib/registry-source.ts
    - apps/web/src/routes/v1.plugins.$name.v.$version.files.$.ts
  tests:
    - apps/web/src/lib/registry-source.test.ts
---

## Description

`GET /v1/plugins/:name/v/:version/files/<path>` extracts a single file from the
published tarball. The requested path is validated before any storage access: empty,
absolute, and parent-traversal paths are rejected, so a caller cannot escape the
tarball to read arbitrary files.

## Acceptance criteria

### HARDEN-006-AC1 , A parent-traversal asset path is blocked before storage access
```gherkin
Given a request for an asset path containing a .. segment
When the asset endpoint handles it
Then the response status is 400 with an invalid asset path error
And no tarball is fetched and no storage read occurs
```

### HARDEN-006-AC2 , Empty and absolute asset paths are rejected
```gherkin
Given a request for an asset path that is empty or starts with a leading slash
When the asset endpoint handles it
Then the response status is 400 with an invalid asset path error
```

### HARDEN-006-AC3 , A safe in-tarball path is served
```gherkin
Given a request for a normal relative path that exists in the tarball
When the asset endpoint handles it
Then the response status is 200 with the file bytes and its content type
And the response carries an immutable cache-control header
```
