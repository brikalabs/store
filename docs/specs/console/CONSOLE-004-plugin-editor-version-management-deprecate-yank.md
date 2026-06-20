---
id: CONSOLE-004
title: "Plugin editor version management (deprecate / yank)"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard/plugins/$.tsx
    - apps/web/src/routes/api.plugins.versions.ts
    - api.plugins.deprecate.ts
    - api.plugins.yank.ts
  tests: []
---

## Description

The per-plugin console page at `/dashboard/plugins/<name>` is stripped to version
management (the editable store-listing override was removed, see CONSOLE-005). It
loads the package's versions and a `canManage` flag from
`GET /api/plugins/versions`. Per-version deprecate/un-deprecate and yank/un-yank
hit `POST /api/plugins/deprecate` and `POST /api/plugins/yank`. Mutations are
gated server-side by the domain ownership policy (enforces MANAGE rules), so the
UI buttons are a convenience only.

## Acceptance criteria

### CONSOLE-004-AC1 , Versions panel lists each version with state badges
```gherkin
Given the editor is open for a registry-hosted plugin the user can manage
When the Versions panel loads from GET /api/plugins/versions
Then it lists each published version
And each row shows a latest, deprecated, or yanked badge matching that version's state
```

### CONSOLE-004-AC2 , Deprecate a version
```gherkin
Given a manageable, non-deprecated version row
When the user clicks Deprecate
Then POST /api/plugins/deprecate is sent for that name and version
And on a 200 the panel reloads and the version shows the deprecated badge
```

### CONSOLE-004-AC3 , Yank a version
```gherkin
Given a manageable, non-yanked version row
When the user clicks Yank
Then POST /api/plugins/yank is sent with yanked true for that name and version
And on a 200 the panel reloads and the version shows the yanked badge
```

### CONSOLE-004-AC4 , canManage gates the per-version action buttons
```gherkin
Given GET /api/plugins/versions returns canManage false
When the Versions panel renders
Then no deprecate or yank buttons are shown on any version row
And a note explains version management is limited to scopes the user belongs to
```

### CONSOLE-004-AC5 , A package not on the registry shows a note instead of controls
```gherkin
Given the page is open for a name not published to the Brika registry
When GET /api/plugins/versions responds 404
Then the Versions panel shows the "available for plugins published to the Brika registry" note instead of a version list
```

### CONSOLE-004-AC6 , Failed mutation surfaces the server error
```gherkin
Given the user clicks Deprecate or Yank on a version
When the API responds with a non-2xx status (e.g. 403 from the ownership policy)
Then the panel shows the returned error message
And the version's state is left unchanged
```
