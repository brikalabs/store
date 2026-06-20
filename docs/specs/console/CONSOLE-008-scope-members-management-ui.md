---
id: CONSOLE-008
title: "Scope members management UI"
status: done
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.scopes_.$scope.tsx
    - apps/web/src/routes/api.scopes.$scope.members.ts
    - api.scopes.$scope.members.$memberId.ts
  tests: []
---

## Description

`/dashboard/scopes/<scope>` lists members and, for admins, lets them add a member,
change a member's role, and remove a member. Admin-only controls are hidden for
non-admin members (who see roles read-only). Enforces SCOPE membership rules
server-side (e.g. cannot demote/remove the last admin surfaces as 409).

## Acceptance criteria

### CONSOLE-008-AC1 , Scope detail lists members
```gherkin
Given the user is a member of the scope
When the user opens /dashboard/scopes/<scope>
Then GET /api/scopes/<scope>/members is fetched
And each member is listed with their id and role
```

### CONSOLE-008-AC2 , Admin sees member-management controls
```gherkin
Given the signed-in user is an admin of the scope
When the members list renders
Then each member row shows a role select and a remove control
And an add-member form is shown
```

### CONSOLE-008-AC3 , Non-admin controls are hidden
```gherkin
Given the signed-in user is a non-admin member of the scope
When the members list renders
Then no role select, remove control, or add-member form is shown
And each member's role is displayed read-only
```

### CONSOLE-008-AC4 , Admin adds a member
```gherkin
Given an admin enters a GitHub login and a role in the add-member form
When the form is submitted
Then PUT /api/scopes/<scope>/members is sent with that memberId and role
And on a 200 the input resets and the members list reloads with the new member
```

### CONSOLE-008-AC5 , Admin changes a member's role
```gherkin
Given an admin changes a member's role select
When the change is committed
Then PUT /api/scopes/<scope>/members is sent for that member with the new role
And on a 200 the members list reloads
```

### CONSOLE-008-AC6 , Admin removes a member
```gherkin
Given an admin activates a member's remove control
When the request is sent
Then DELETE /api/scopes/<scope>/members/<memberId> is sent
And on a 200 the members list reloads without that member
```

### CONSOLE-008-AC7 , Last-admin guard surfaces the conflict
```gherkin
Given an admin attempts to remove or demote the scope's last admin
When the request is sent
Then the API responds 409 (enforces SCOPE last-admin rule)
And the page shows the returned error message
```
