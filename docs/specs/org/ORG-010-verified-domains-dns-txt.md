---
id: ORG-010
title: "Verified domains (DNS TXT, stateless challenge, badge-only)"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - packages/registry-core/src/scope-ports.ts
    - packages/db/src/adapters/d1-scope-domains.ts
    - packages/db/src/adapters/hmac-domain-challenge.ts
    - packages/db/src/adapters/doh-resolver.ts
    - apps/registry/src/controllers/scope.ts
    - apps/registry/src/index.ts
    - apps/web/src/routes/api/scopes
  tests:
    - packages/registry-core/src/scope.test.ts
    - packages/db/src/adapters/d1-scope-domains.test.ts
    - packages/db/src/adapters/hmac-domain-challenge.test.ts
---

## Description

A scope admin can prove control of a domain and earn a public "verified" badge. The
challenge is **stateless**: the expected TXT value is `HMAC(server-secret, "<scope>:<domain>")`,
derived on demand (nothing per-domain is stored), published by the owner at
`_brika-challenge.<domain>`, and checked over DNS-over-HTTPS (Workers cannot do raw DNS).
This is badge-only - it does not yet gate claiming (that is ORG-006). A scheduled sweep
keeps the verified set honest as DNS changes. Domains live on `reg_scope_domains`.

## Acceptance criteria

### ORG-010-AC1 , claim, publish the TXT, and verify
```gherkin
Given I am an admin of scope "@acme"
When I claim the domain "acme.dev"
Then I am shown a TXT host "_brika-challenge.acme.dev" and a derived challenge value
And no challenge is stored in the database
When the challenge TXT is present in DNS and I verify
Then "acme.dev" is marked verified and shows a badge on "/@acme"
```

### ORG-010-AC2 , only admins may claim or verify
```gherkin
Given I am a non-admin member of scope "@acme"
When I attempt to claim or verify a domain
Then I get 403 forbidden
And verifying a domain the scope has not claimed is not found
```

### ORG-010-AC3 , scheduled re-verification revokes stale domains, skips DNS errors
```gherkin
Given scope "@acme" has a verified domain "acme.dev"
When the scheduled re-verification runs and the challenge TXT no longer resolves
Then "acme.dev" is set unverified and loses its badge
But when the DNS lookup fails for a transport reason
Then the domain is left untouched (no revocation on a transient error)
```
