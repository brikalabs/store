---
id: REG-011
title: "Tarball origin pinned to REGISTRY_URL"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/npm-url.ts
    - packages/registry-core/src/packument.ts
    - packages/registry-core/src/resolve.ts
  tests:
    - apps/registry/src/controllers/packages.test.ts
---

## Description

The `dist.tarball` URL is built from the configured `REGISTRY_URL` base, not the
request `Host` header, so a client cannot poison the resolved download origin by
spoofing `Host`, and tarball URLs are stable across edge nodes.

## Acceptance criteria

### REG-011-AC1 , dist.tarball uses the configured registry base, not Host
```gherkin
Given the registry is configured with REGISTRY_URL "https://registry.brika.dev"
When a client sends GET /@brika/plugin-weather with Host "evil.example.com"
Then every versions[*].dist.tarball begins with "https://registry.brika.dev/"
And no dist.tarball references "evil.example.com"
```
