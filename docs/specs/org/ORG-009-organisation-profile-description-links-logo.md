---
id: ORG-009
title: "Organisation profile: description, links, and logo"
status: done
area: org
group: org
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/profile.ts
    - packages/registry-core/src/org.ts
    - packages/db/src/adapters/d1-org-store.ts
    - apps/registry/src/controllers/org.ts
    - apps/web/src/routes/api.orgs.$org.profile.ts
    - apps/web/src/routes/api.orgs.$org.icon.ts
    - apps/web/src/components/org/profile-card.tsx
    - apps/web/src/components/org/logo-card.tsx
    - apps/web/src/routes/orgs.$org.tsx
  tests:
    - packages/registry-core/src/profile.test.ts
    - packages/registry-core/src/org.test.ts
    - packages/db/src/adapters/d1-org-store.test.ts
---

## Description

An organisation has an editable public profile: a free-text description, an arbitrary set
of labelled external links (X, LinkedIn, npm, a docs site, ...), and an uploaded logo.
All are admin-only to edit and render on the public org page; links and description live on
`reg_orgs`, while the logo's bytes live in object storage (R2) keyed by `icon_key`.

## Acceptance criteria

### ORG-009-AC1 , an admin sets the description + links; they show publicly
```gherkin
Given I am an admin of organisation "acme"
When I save a description and one or more links
Then the description and links are stored on the org
And they render on the public page "/orgs/acme"
And each link shows an icon inferred from its URL (a generic globe when unknown)
```

### ORG-009-AC2 , links are arbitrary, http(s)-only, and bounded
```gherkin
Given I am editing organisation "acme" links
When I add a link
Then any label and any https or http URL is accepted
And a non-http(s) URL (e.g. "javascript:") is refused
And the number of links is capped
```

### ORG-009-AC3 , an admin uploads a logo; otherwise a generated avatar is used
```gherkin
Given I am an admin of organisation "acme"
When I upload a PNG, JPEG, or WebP image up to 512 KiB
Then it is stored and served as the org's logo on "/orgs/acme"
And clearing it falls back to the deterministic generated avatar
And a non-image or oversized upload is refused
```

### ORG-009-AC4 , only admins may edit the profile or logo
```gherkin
Given I am a non-admin member of organisation "acme"
When I attempt to set the profile or upload a logo
Then I get 403 forbidden
```
