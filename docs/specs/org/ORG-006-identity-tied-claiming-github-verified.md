---
id: ORG-006
title: "Identity-tied claiming (GitHub-verified)"
status: todo
area: org
group: org
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

You may only claim an org/scope whose name matches a GitHub identity you provably
control: your own login, or a GitHub org where you are an admin.

## Acceptance criteria

### ORG-006-AC1 , claim a name you control
```gherkin
Given I am the GitHub user "alice"
When I claim org "alice"
Then the claim succeeds
```

### ORG-006-AC2 , claim a GitHub org you admin
```gherkin
Given I am an admin of the GitHub organisation "acme"
When I claim org "acme"
Then the claim succeeds
```

### ORG-006-AC3 , cannot claim a name you do not control
```gherkin
Given I am the GitHub user "alice"
And I am not associated with "microsoft"
When I claim org "microsoft"
Then the claim is refused as not verifiably mine
And no new org is created
```
