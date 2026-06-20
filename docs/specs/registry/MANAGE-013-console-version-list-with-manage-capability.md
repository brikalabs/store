---
id: MANAGE-013
title: "Console version list with manage capability"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api.plugins.versions.ts
  tests:
    - packages/registry-core/src/manage.test.ts
---

## Description

The console lists a package's versions and tells the UI whether the signed-in user may
manage them, so the Versions panel only offers deprecate/yank to members.

## Acceptance criteria

### MANAGE-013-AC1 , The version list reports canManage for a member
```gherkin
Given a signed-in user who is a member of the package scope
When the user GETs /api/plugins/versions?name=<package>
Then the response lists the package versions with their current deprecated and yanked state
And canManage is true
```

### MANAGE-013-AC2 , The version list reports canManage false for a non-member
```gherkin
Given a signed-in user who is not a member of the package scope
When the user GETs /api/plugins/versions?name=<package>
Then the response lists the versions
And canManage is false
```
