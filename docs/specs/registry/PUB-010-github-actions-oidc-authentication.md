---
id: PUB-010
title: "GitHub Actions OIDC authentication"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/auth.ts
    - packages/registry-core/src/oidc.ts
    - apps/registry/src/adapters/github-jwks.ts
  tests:
    - packages/registry-core/src/oidc.test.ts
---

## Description

Trusted (tokenless) publishing from CI. A GitHub Actions OIDC token is verified by RS256
signature against GitHub's JWKS, then by issuer, audience (brika-registry), and time
window, yielding a forge-proof publish identity.

## Acceptance criteria

### PUB-010-AC1 , A valid OIDC token authorizes a write as a github identity
```gherkin
Given a request with a Bearer GitHub Actions OIDC token valid for audience "brika-registry"
When the publish endpoint authenticates the write
Then the resolved identity has provider "github" and owner equal to the token's repository_owner
And its repository equals the token's repository
```

### PUB-010-AC2 , An OIDC token with a wrong audience or issuer is rejected
```gherkin
Given a Bearer OIDC token whose audience or issuer does not match what the endpoint requires
And no valid publish token is presented
When the publish endpoint authenticates the write
Then the request is rejected with 401 Unauthorized
```

### PUB-010-AC3 , An OIDC token with a bad signature or expired window is rejected
```gherkin
Given a Bearer OIDC token whose RS256 signature fails, or whose exp is past or nbf is future
And no valid publish token is presented
When the publish endpoint authenticates the write
Then the request is rejected with 401 Unauthorized
```
