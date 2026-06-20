---
id: SCOPE-009
title: "Set the verified publisher display name (admin only, validated)"
status: done
area: scope
group: registry
test_mode: unit
traceability:
  code:
    - packages/registry-core/src/scope.ts
    - packages/registry-core/src/labels.ts
    - apps/registry/src/controllers/scope.ts
  tests:
    - packages/registry-core/src/labels.test.ts
---

## Description

The display name is the publisher label users are told to trust over the manifest
`author`, so only an admin may set it and its value is validated by the shared
`displayNameSchema`: 1-120 chars, normalized to NFC, rejecting invisible / control /
format / spoofing characters. A null value clears the label. `POST /-/scope/:scope/display-name`.

## Acceptance criteria

### SCOPE-009-AC1 , An admin can set the display name
```gherkin
Given the scope @acme has admin alice and no display name
And the caller's verified identity is provider=github owner=alice
When the caller sets the display name to "Acme Corporation"
When the registry handles POST /-/scope/@acme/display-name with body {displayName: "Acme Corporation"}
Then the result is ok with displayName "Acme Corporation"
And the reg_scopes row for @acme has displayName="Acme Corporation"
And the HTTP response status is 200
```

### SCOPE-009-AC2 , A display name with invisible or control characters is rejected
```gherkin
Given the caller's verified identity is provider=github owner=alice who is an admin of @acme
When the caller submits a display name containing a zero-width or control character
Then displayNameSchema validation fails
And the HTTP response status is 400
And the reg_scopes displayName is unchanged
```

### SCOPE-009-AC3 , A display name outside 1-120 chars is rejected
```gherkin
Given the caller is an admin of @acme
When the caller submits an empty display name or one longer than 120 characters
Then displayNameSchema validation fails
And the HTTP response status is 400
```

### SCOPE-009-AC4 , A non-admin cannot set the display name
```gherkin
Given the scope @acme has admin alice and member bob
And the caller's verified identity is provider=github owner=bob
When the caller sets the display name to "Acme"
Then the result is not ok with code forbidden
And the HTTP response status is 403
And the reg_scopes displayName is unchanged
```

### SCOPE-009-AC5 , Passing null clears the display name
```gherkin
Given the scope @acme has admin alice and displayName="Acme Corporation"
And the caller's verified identity is provider=github owner=alice
When the caller sets the display name to null
Then the result is ok with displayName null
And the reg_scopes row for @acme has displayName null
```
