---
id: PUB-005
title: "Data/manifest gate (required metadata + bundled locales)"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/adapters/manifest-validator.ts
    - packages/schema/src/store.ts
  tests:
    - apps/registry/src/adapters/manifest-validator.test.ts
---

## Description

The publishability gate. `@brika/schema` is the single source of truth: the manifest must
carry the store metadata the registry lists (icon, displayName/title, description), every
bundled file must be within per-file and unpacked size limits, any embedded package.json
must match the published identity, and every bundled `locales/<lang>/store.json` must
validate against the locale schema.

## Acceptance criteria

### PUB-005-AC1 , Manifest missing required store metadata is rejected as invalid
```gherkin
Given a manifest missing a required publish field (icon, displayName, or description)
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

### PUB-005-AC2 , Manifest with required store metadata passes the data gate
```gherkin
Given a manifest carrying a valid icon, displayName, and description
And a tarball that is a readable gzip archive within size limits
When the package is published
Then the data gate passes and evaluation proceeds to the next gate
```

### PUB-005-AC3 , Unreadable or oversized tarball content is rejected as invalid
```gherkin
Given a tarball that is not a readable gzip archive, or contains a file over the per-file limit, or whose unpacked total exceeds the unpacked limit
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

### PUB-005-AC4 , Embedded package.json that diverges from the published manifest is rejected
```gherkin
Given a tarball whose bundled package.json declares a name/version other than the published manifest
When the package is published
Then the publish result is not ok with code "invalid"
And the endpoint responds 400
And no tarball is written and no version metadata is committed
```

### PUB-005-AC5 , An invalid bundled locale file is rejected as invalid
```gherkin
Given a tarball containing a locales/<lang>/store.json that does not match the store locale schema
When the package is published
Then the publish result is not ok with code "invalid"
And the response message names the offending locale path
And no tarball is written and no version metadata is committed
```

### PUB-005-AC6 , Every bundled locale file is validated
```gherkin
Given a tarball with multiple locales/<lang>/store.json files all matching the store locale schema
When the package is published
Then the data gate passes for all bundled locale files
```
