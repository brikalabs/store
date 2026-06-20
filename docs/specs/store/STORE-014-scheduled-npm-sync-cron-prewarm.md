---
id: STORE-014
title: "Scheduled npm sync (CRON prewarm)"
status: gone
area: store
group: store
test_mode: none
traceability:
  code:
    - apps/web/wrangler.jsonc
  tests: []
---

## Description

> **Superseded/removed: there is no npm catalog to sync.** The storefront is registry-only, so there is no npm-derived catalog to prewarm; discovery reads the hosted registry catalog directly (see the deleted npm federation, STORE-009). Retained for history.

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
