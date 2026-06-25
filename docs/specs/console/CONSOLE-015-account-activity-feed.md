---
id: CONSOLE-015
title: "Dashboard account activity feed"
status: done
area: console
group: console
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api/account/activity.ts
  tests: []
---

## Description

The dashboard overview shows a "Recent activity" feed of the signed-in developer's
own audit events (publishes, yanks, deprecations, reservations, scope changes) across
every scope they belong to, newest first, backed by real audit entries rather than a
plugin snapshot.

## Acceptance criteria

### CONSOLE-015-AC1 , the feed shows the developer's recent events across their scopes
```gherkin
Given a signed-in developer who belongs to one or more scopes
When they GET /api/account/activity
Then recent audit events for those scopes are returned newest first
```

### CONSOLE-015-AC2 , the feed is capped
```gherkin
Given a developer with many recent events
When the activity feed is fetched
Then at most 8 entries are returned
```

### CONSOLE-015-AC3 , the feed requires a session
```gherkin
Given no signed-in session
When /api/account/activity is requested
Then the response is 401
```
