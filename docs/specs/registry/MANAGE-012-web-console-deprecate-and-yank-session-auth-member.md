---
id: MANAGE-012
title: "Web console deprecate and yank (session-auth, member-gated)"
status: done
area: manage
group: registry
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api.plugins.deprecate.ts
    - apps/web/src/routes/api.plugins.yank.ts
    - apps/web/src/routes/dashboard.plugins.$.tsx
  tests:
    - packages/registry-core/src/manage.test.ts
---

## Description

The developer console exposes deprecate and yank from the plugin Versions panel. The
routes authenticate by session and gate on scope membership through the same
ManagementService ownership check as the registry endpoints. Takedown and restore are
operator-only and are deliberately absent from the console.

## Acceptance criteria

### MANAGE-012-AC1 , A signed-in scope member deprecates from the console
```gherkin
Given a signed-in user who is a member of the package scope
When the user POSTs /api/plugins/deprecate for a version with a message (or null)
Then the response reports ok with the resulting deprecated state
```

### MANAGE-012-AC2 , A signed-in scope member yanks from the console
```gherkin
Given a signed-in user who is a member of the package scope
When the user POSTs /api/plugins/yank for a version with a yanked boolean
Then the response reports ok with the resulting yanked state
```

### MANAGE-012-AC3 , A signed-in non-member is refused
```gherkin
Given a signed-in user who is not a member of the package scope
When the user POSTs /api/plugins/deprecate or /api/plugins/yank for that package
Then the operation is refused and the version's state is unchanged
```
