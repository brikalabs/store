---
id: HARDEN-013
title: "Scheduled R2 + D1 backups"
status: todo
area: harden
group: registry
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

A scheduled cron handler exports registry state to a dedicated backup bucket: each
`reg_*` D1 table as a timestamped NDJSON snapshot, plus an R2 tarball manifest
(key, size, integrity). Retention prunes snapshots older than N days, and a manual
operator-run restore script reads a snapshot back into D1. The export logic sits
behind a `BackupSink` port so it is testable against an in-memory sink.

## Acceptance criteria

### HARDEN-013-AC1 , A scheduled run writes a timestamped snapshot of every table
```gherkin
Given the backup cron handler runs against an in-memory BackupSink
When the export completes
Then a timestamped NDJSON object is written for each reg_* table under d1/<date>/<table>.ndjson
And an R2 tarball manifest is written under r2/<date>/manifest.ndjson
```

### HARDEN-013-AC2 , Retention prunes snapshots older than the window
```gherkin
Given snapshots exist that are older than the retention window
When the backup run completes
Then those expired snapshots are deleted from the backup sink
And snapshots within the window are retained
```

### HARDEN-013-AC3 , The restore script reloads a snapshot into D1
```gherkin
Given an operator runs the restore script against a chosen snapshot
When it completes
Then the reg_* tables are populated from that snapshot's rows
```
