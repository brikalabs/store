---
id: REG-002
title: "Fetch abbreviated packument"
status: done
area: reg
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/packument.ts
    - apps/registry/src/controllers/packages.ts
  tests:
    - packages/registry-core/src/packument.test.ts
---

## Description

When a client sends `Accept: application/vnd.npm.install-v1+json` (what `bun` and
`npm` send on install), the same route returns the smaller install metadata:
install-relevant manifest fields only, no readme or full scripts, and the
response varies by `Accept` so caches key on it.

## Acceptance criteria

### REG-002-AC1 , abbreviated content type and trimmed shape
```gherkin
Given a published package "@brika/plugin-weather"
When a client sends GET /@brika/plugin-weather with Accept "application/vnd.npm.install-v1+json"
Then the response status is 200
And the Content-Type is "application/vnd.npm.install-v1+json"
And the body has "name", "dist-tags", "versions", and a "modified" timestamp
And the body has no "time" object, no "readme", and no "publisher" field
```

### REG-002-AC2 , per-version fields are limited to install metadata
```gherkin
Given the abbreviated packument for "@brika/plugin-weather"
When the client reads a version entry
Then it contains "dist" (tarball, integrity, shasum)
And it contains only install-relevant manifest fields (dependencies, peerDependencies, optionalDependencies, bin, engines, os, cpu, directories, funding and similar)
And it contains a boolean "hasInstallScript" that is true only when the manifest has an install, preinstall, or postinstall script
And it does not contain "readme" or the full "scripts" object
```

### REG-002-AC3 , response varies by Accept
```gherkin
Given the registry serves both packument forms on the same path
When a client inspects the response to GET /@brika/plugin-weather
Then the response includes the header "Vary: accept"
```
