---
id: PUB-016
title: "Trusted publisher bindings for tokenless OIDC publishing"
status: done
area: pub
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/trusted-publishers.ts
    - packages/registry-core/src/oidc.ts
    - packages/db/src/adapters/d1-trusted-publishers.ts
    - packages/db/src/adapters/d1-ownership.ts
    - apps/registry/src/controllers/org.ts
    - apps/registry/src/adapters/jwks.ts
    - apps/cli/src/commands/publish.ts
    - apps/web/src/components/org/trusted-publishers-card.tsx
    - apps/web/src/routes/api/orgs/$org/scopes/$scope/trusted-publishers.ts
  tests:
    - packages/registry-core/src/trusted-publishers.test.ts
    - packages/registry-core/src/oidc.test.ts
    - packages/db/src/adapters/d1-ownership.test.ts
    - packages/registry-core/src/org.test.ts
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

Plugins are published to the Brika registry (not public npm). A tokenless CI publish is
authorized by a **trusted-publisher binding** (npm-style): an org admin authorizes a specific
provider + repo + workflow to publish under a scope the org owns. A verified CI OIDC token
whose project + workflow claims match a binding may publish; without a matching binding it is
refused (membership is not a fallback for CI). Bindings + verification are **provider-agnostic**
(GitHub and GitLab today; the binding carries the provider and the registry dispatches OIDC
verification by issuer). Human `brika` CLI publishes stay org-membership-gated. Authorization
works on any system via a `BRIKA_TOKEN`; tokenless OIDC works on GitHub (CLI mints the token)
and GitLab (a CI `id_token` passed as `BRIKA_OIDC_TOKEN`). The console (`Trusted publishers`
card) manages bindings per scope.

## Acceptance criteria

### PUB-016-AC1 , a matching binding authorizes an OIDC publish
```gherkin
Given scope "@acme" is owned by an org with a trusted publisher for repo "acme/plugin-x" workflow "publish.yml"
When a verified GitHub OIDC token from "acme/plugin-x" workflow "publish.yml" publishes "@acme/plugin-x"
Then the publish is authorized
```

### PUB-016-AC2 , no binding refuses an OIDC publish
```gherkin
Given scope "@acme" has no trusted publisher for the publishing repo and workflow
When a verified GitHub OIDC token attempts to publish "@acme/plugin-x"
Then the publish is refused as forbidden
```

### PUB-016-AC3 , only an org admin manages bindings for an owned scope
```gherkin
Given I am an admin of the org that owns scope "@acme"
When I add or remove a trusted publisher for "@acme"
Then it succeeds
And a non-admin, or a scope the org does not own, is refused
```
