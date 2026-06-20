---
id: STORE-014
title: "Scheduled npm sync (CRON prewarm)"
status: todo
area: store
group: store
test_mode: none
traceability:
  code:
    - apps/web/wrangler.jsonc
  tests: []
---

## Description

A scheduled Worker job to periodically refresh the npm-derived catalog (packuments,
download counts) so discovery is warm and fresh without waiting on first-request
fetches. The wrangler config notes where the cron trigger goes, but no `scheduled()`
handler exists yet.

## Acceptance criteria

### STORE-014-AC1 , A scheduled job refreshes the npm catalog (pending)
```gherkin
Given a cron trigger is configured and a scheduled() handler exists
When the schedule fires
Then the npm catalog (packuments and download counts) is refreshed
And subsequent discovery requests are served from the warmed data
```
