---
id: HARDEN-014
title: "Operator provisioning of hardening infrastructure"
status: hold
area: harden
group: registry
test_mode: manual
traceability:
  code:
    - apps/registry/wrangler.jsonc
    - apps/registry/src/env.ts
  tests: []
---

## Description

The operator-side steps that activate the shipped hardening: creating the
`PUBLISH_LIMITER` and `DEVICE_LIMITER` rate-limit namespaces, the
`brika-registry-backups` bucket and cron trigger, and setting `REGISTRY_ADMINS`.
Blocked on operator credentials; the code paths degrade safely until then (in-memory
rate-limit fallback, empty admin allowlist, no scheduled backups).

## Acceptance criteria

### HARDEN-014-AC1 , Rate-limit namespaces are provisioned and bound
```gherkin
Given the operator has created the PUBLISH_LIMITER and DEVICE_LIMITER namespaces
When the worker is deployed with those bindings present
Then the distributed binding enforces the limits instead of the per-isolate fallback
```

### HARDEN-014-AC2 , The admin allowlist is set so takedown is operable
```gherkin
Given the operator has set REGISTRY_ADMINS to the operator identities
When an operator with a matching credential calls takedown or restore
Then requireAdmin authorizes the request
```

### HARDEN-014-AC3 , The backup cron trigger and bucket are provisioned
```gherkin
Given the operator has created the brika-registry-backups bucket and the cron trigger
When the schedule fires
Then the scheduled handler runs and writes snapshots to the backup bucket
```
