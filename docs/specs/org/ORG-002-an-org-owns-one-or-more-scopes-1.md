---
id: ORG-002
title: "An org owns one or more scopes (1:N)"
status: todo
area: org
group: org
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

An organisation is a distinct entity with its own slug that can own multiple npm
scopes. Membership lives on the org; a scope belongs to exactly one org.

## Acceptance criteria

### ORG-002-AC1 , create an org
```gherkin
Given I am authenticated
When I create organisation "acme"
Then the org exists with me as its admin
And its public page lives at "/org/acme"
```

### ORG-002-AC2 , an org owns multiple scopes
```gherkin
Given I admin organisation "acme"
When I attach scope "@acme" and scope "@acme-labs" to it
Then both scopes are owned by org "acme"
And org membership governs publishing to both
```

### ORG-002-AC3 , a scope belongs to exactly one org
```gherkin
Given scope "@acme" is owned by org "acme"
When anyone attempts to attach "@acme" to a different org
Then it is refused (a scope cannot belong to two orgs)
```
