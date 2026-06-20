---
id: HARDEN-001
title: "Publish rate limit, keyed by authenticated principal"
status: done
area: harden
group: registry
test_mode: unit
traceability:
  code:
    - apps/registry/src/controllers/publish.ts
    - apps/registry/src/auth.ts
  tests:
    - packages/router/src/rate-limit.test.ts
---

## Description

`POST /-/publish` is capped at 100 requests per minute, keyed by the authenticated
principal (the OIDC repository, else the publish-token owner). CI shares GitHub
Actions egress IPs, so a per-IP cap would throttle unrelated repos on the same
runner; keying by identity isolates publishers. Over the limit the request is
rejected before the handler runs.

## Acceptance criteria

### HARDEN-001-AC1 , A burst past the publish limit returns 429 with Retry-After
```gherkin
Given an authenticated publisher has made 100 POST /-/publish requests within one minute
When the same principal makes one more POST /-/publish request in that window
Then the response status is 429
And the response carries a Retry-After header with the seconds until the window resets
And the publish handler does not run (no tarball is staged and no version is committed)
```

### HARDEN-001-AC2 , The limit is keyed by principal, not by client IP
```gherkin
Given two different principals share one client IP (the same CI runner egress)
And one principal has exhausted its 100/minute publish budget
When the other principal makes a POST /-/publish request in that window
Then that request is not rate limited and reaches the publish handler
```
