---
id: HARDEN-007
title: "Scoped read-only CORS on the registry read surface"
status: done
area: harden
group: registry
test_mode: manual
traceability:
  code:
    - apps/registry/src/index.ts
  tests: []
---

## Description

The registry serves the public npm protocol cross-origin so any browser client can
read packuments, tarballs, and the catalog. CORS is opened with `origin: *` but
scoped to read methods only (GET, HEAD, OPTIONS), so a browser cannot drive a
cross-origin mutating request against publish or management.

## Acceptance criteria

### HARDEN-007-AC1 , Cross-origin reads are allowed
```gherkin
Given a cross-origin browser request for a packument, tarball, or the catalog
When the registry responds
Then the response carries Access-Control-Allow-Origin: *
And a GET preflight advertises GET, HEAD, and OPTIONS as allowed methods
```

### HARDEN-007-AC2 , Cross-origin mutating methods are not advertised as allowed
```gherkin
Given a CORS preflight asking to use POST against a registry endpoint
When the registry responds
Then POST is not listed among the Access-Control-Allow-Methods
```
