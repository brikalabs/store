---
id: REG-004
title: "Download tarball"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/packages.ts
    - apps/registry/src/adapters/r2-tarball.ts
  tests:
    - apps/registry/src/controllers/packages.test.ts
---

## Description

`GET /:name/-/:file` streams the immutable tarball bytes from object storage. The
filename must parse to a known `name@version`; otherwise it is a 404. Tarballs are
content-immutable, so they are cacheable forever.

## Acceptance criteria

### REG-004-AC1 , 200 streams the tarball with octet-stream content type
```gherkin
Given the tarball for "@brika/plugin-weather@1.1.0" exists in storage
When a client sends GET /@brika/plugin-weather/-/plugin-weather-1.1.0.tgz
Then the response status is 200
And the Content-Type is "application/octet-stream"
And the body is the raw tarball bytes
```

### REG-004-AC2 , tarballs are cached as immutable
```gherkin
Given a successful tarball download
When the client inspects the response headers
Then the Cache-Control is "public, max-age=31536000, immutable"
```

### REG-004-AC3 , unparseable filename is 404
```gherkin
Given a client requests a file that does not match "<name>-<version>.tgz"
When a client sends GET /@brika/plugin-weather/-/garbage.tgz
Then the response status is 404
```

### REG-004-AC4 , missing tarball bytes are 404
```gherkin
Given "@brika/plugin-weather@9.9.9" has no bytes in object storage
When a client sends GET /@brika/plugin-weather/-/plugin-weather-9.9.9.tgz
Then the response status is 404
```
