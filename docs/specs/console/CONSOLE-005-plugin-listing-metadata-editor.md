---
id: CONSOLE-005
title: "Plugin listing-metadata editor"
status: gone
area: console
group: console
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/dashboard.plugins.$.tsx
    - apps/web/src/lib/listing.ts
    - apps/web/src/lib/listing-ownership.ts
    - apps/web/src/lib/listing-merge.ts
    - apps/web/src/routes/api.plugins.$name.listing.ts
  tests:
    - apps/web/src/lib/listing.test.ts
---

## Description

> **Superseded/removed: editable listing overrides were dropped.** In the registry-only model a plugin's listing is its published, immutable manifest, the single source of truth, so the store-level override layer is gone: the `plugin_listings` table was dropped (migration `apps/web/drizzle/0003_dusty_madame_web.sql`) and the per-plugin console page is stripped to version management (CONSOLE-004). To change how a plugin appears, publish a new version. Retained for history.

The plugin editor persists a store-level listing override (display name, summary,
description, public/unlisted visibility) to D1, layered on top of the package
manifest at read time so a maintainer can change how their plugin appears without
republishing a version. Writes are session-authenticated and ownership-gated (scope
member for an `@scope` package, npm maintainer otherwise); the public plugin page
merges the override. Deferred to a follow-up: icon/screenshot upload, editable
keywords, and per-locale text overrides (the language switcher reflects the real
shipped locales).

## Acceptance criteria

### CONSOLE-005-AC1 , listing override round-trips
```gherkin
Given a maintainer saves a display name and description for their plugin
When the listing is read back
Then the stored override returns those values
And saving again replaces them (a blank field clears to null)
```

### CONSOLE-005-AC2 , the public page merges the override over the manifest
```gherkin
Given a plugin has a store-listing override for its display name
And no override for its description
When the public plugin page is rendered
Then it shows the overridden display name
And it shows the manifest description (the unset field falls through)
```

### CONSOLE-005-AC3 , only a maintainer may edit the listing
```gherkin
Given a user who is not a member of the plugin's scope and not an npm maintainer
When they PUT the plugin's listing
Then the request is forbidden (403)
And no override is written
```
