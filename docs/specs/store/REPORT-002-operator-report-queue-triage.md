---
id: REPORT-002
title: "Operator report queue and triage"
status: done
area: report
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/api/operator/reports.ts
    - apps/web/src/routes/api/operator/reports/update.ts
    - apps/web/src/routes/operator/reports.tsx
    - apps/web/src/server/services/social-service.ts
  tests: []
---

## Description

Operators triage plugin reports from a moderation queue: a paged list (newest first)
with per-status counts and filters by status, reason, and free-text query. An open
report can be resolved or dismissed, which clears it from the queue and from the
package's report count. Every triage action is recorded in the audit log.

## Acceptance criteria

### REPORT-002-AC1 , the queue lists open reports newest first with counts
```gherkin
Given an operator and a queue containing open reports
When they GET /api/operator/reports
Then the response is a page of reports newest first (status defaults to "open")
And it includes per-status counts for the filter chips
```

### REPORT-002-AC2 , the queue can be filtered
```gherkin
Given an operator
When they GET /api/operator/reports with a status, reason, or q parameter
Then only reports matching every supplied filter are returned
```

### REPORT-002-AC3 , the queue is hidden from non-operators
```gherkin
Given a signed-in non-operator (or a signed-out request)
When they GET /api/operator/reports
Then the response is 404
```

### REPORT-002-AC4 , resolving or dismissing a report clears it and is audited
```gherkin
Given an operator and an open report
When they POST /api/operator/reports/update with status "resolved" or "dismissed"
Then the report leaves the open queue
And the package's report count drops accordingly
And an audit entry "report_resolved" or "report_dismissed" is written
```

### REPORT-002-AC5 , updating a missing report is a 404
```gherkin
Given an operator
When they update a report id that does not exist
Then the response is 404
```
