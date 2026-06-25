---
id: REPORT-001
title: "File a moderation report against a plugin"
status: done
area: report
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1/plugins/$name/reports.ts
    - apps/web/src/lib/reports.ts
    - apps/web/src/server/services/social-service.ts
  tests: []
---

## Description

A signed-in user can report a plugin for abuse, picking a reason from a fixed
taxonomy (security, spam, impersonation, broken, dmca, other) plus optional details.
The report lands in the operator moderation queue. Reports are rate-limited per user
so one account cannot flood the queue.

## Acceptance criteria

### REPORT-001-AC1 , a valid report is accepted
```gherkin
Given a signed-in user and an existing plugin
When they POST /v1/plugins/:name/reports with a known reason and optional details
Then the response is 200 with { ok: true }
And the report is stored for operator review
```

### REPORT-001-AC2 , an unknown reason is rejected
```gherkin
Given a signed-in user
When they POST a report with a reason outside the taxonomy
Then the response is a 400 validation error
And no report is stored
```

### REPORT-001-AC3 , reporting requires a session
```gherkin
Given no signed-in session
When a report is POSTed
Then the response is 401
```

### REPORT-001-AC4 , reporting an unknown plugin is a 404
```gherkin
Given a signed-in user
When they report a plugin name that does not exist in the registry
Then the response is 404
```

### REPORT-001-AC5 , reports are rate-limited per user
```gherkin
Given a signed-in user who has hit the per-user report cap
When they submit another report
Then the response is 429
```
