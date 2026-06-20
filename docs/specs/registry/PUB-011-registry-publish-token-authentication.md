---
id: PUB-011
title: "Registry publish-token authentication"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/auth.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

Local publishing from the `brika` CLI. When no OIDC token validates, a registry publish
token is verified and resolves to its owning identity.

## Acceptance criteria

### PUB-011-AC1 , A valid publish token authorizes a write as the token owner
```gherkin
Given a request with a Bearer registry publish token and no OIDC token
When the publish endpoint authenticates the write
Then the resolved identity has the token's provider and owner
And its repository is null (a local token publish has no CI repository)
```

### PUB-011-AC2 , A request with no valid credential is unauthorized
```gherkin
Given a publish request with no Bearer credential, or a token that neither OIDC nor TokenStore.verify accepts
When the publish endpoint authenticates the write
Then the request is rejected with 401 Unauthorized
And no gate runs and no storage is touched
```
