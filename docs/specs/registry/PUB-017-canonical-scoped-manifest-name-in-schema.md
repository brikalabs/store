---
id: PUB-017
title: "Canonical scoped manifest-name enforcement in @brika/schema"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/schema/src/plugin.ts
    - packages/registry-core/src/names.ts
  tests:
    - packages/schema/src/plugin.test.ts
---

## Description

`@brika/schema`'s plugin manifest schema enforces a canonical scoped package name:
`@scope/name`, both segments lowercase `a-z0-9-` and not starting with a hyphen, the
scope 2-20 chars, capped at 214 chars. Brika is scope-only, so an unscoped name is
rejected at build/publish time, before the registry sees it. The manifest regex
mirrors `registry-core/names.ts` `CANONICAL_NAME` (the single source of truth the
publish gate uses, PUB-001), so the build-time schema and the registry never
disagree on what a valid name is.

## Acceptance criteria

### PUB-017-AC1 , A canonical scoped name is accepted
```gherkin
Given a plugin manifest whose name is @myorg/plugin-name
When the manifest is parsed against the plugin schema
Then parsing succeeds
```

### PUB-017-AC2 , An unscoped name is rejected
```gherkin
Given a plugin manifest whose name is "lodash" (no @scope/)
When the manifest is parsed against the plugin schema
Then parsing fails with a "must be scoped" error
```

### PUB-017-AC3 , A non-canonical scoped name is rejected
```gherkin
Given a plugin manifest whose name is "@-bad/plugin", "@a/plugin", or "@scope/"
When the manifest is parsed against the plugin schema
Then parsing fails
```
