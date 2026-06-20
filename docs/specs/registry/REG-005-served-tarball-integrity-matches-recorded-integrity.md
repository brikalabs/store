---
id: REG-005
title: "Served tarball integrity matches recorded integrity"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/integrity.ts
    - packages/registry-core/src/packument.ts
  tests:
    - packages/registry-core/src/integrity.test.ts
---

## Description

The integrity advertised in the packument is the integrity of the bytes served, so
a client's verification (the same check `bun` performs on install) passes and
`name@version` is immutable. Proven end to end: `bun add @brika/plugin-weather`
installs from the registry.

## Acceptance criteria

### REG-005-AC1 , downloaded bytes hash to the advertised integrity
```gherkin
Given the packument advertises dist.integrity for "@brika/plugin-weather@1.1.0"
When a client downloads the tarball at dist.tarball and computes its SHA-512 integrity
Then the computed "sha512-<base64>" equals the advertised dist.integrity
And the computed SHA-1 hex equals the advertised dist.shasum
```

### REG-005-AC2 , a given name@version always serves identical bytes
```gherkin
Given a tarball has been published for "@brika/plugin-weather@1.1.0"
When the same name@version is downloaded again at any later time
Then the bytes are byte-for-byte identical
And the integrity continues to match the originally recorded value
```
