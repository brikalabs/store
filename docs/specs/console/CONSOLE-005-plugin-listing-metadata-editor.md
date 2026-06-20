---
id: CONSOLE-005
title: "Plugin listing-metadata editor"
status: wip
area: console
group: console
test_mode: manual (verified in-browser)
traceability:
  code:
    - apps/web/src/routes/dashboard.plugins.$.tsx
  tests: []
---

## Description

The plugin editor also presents the listing-metadata form: icon upload,
per-locale display name / summary / description with a language switcher,
supported-languages and keyword editors, and a public/unlisted visibility toggle.
This capability is a DEMO stub: Save only sets local component state, with no
persistence. Marked [WIP] until a persistence backend exists. (The Versions panel
in the same page, CONSOLE-004, is [DONE].)

## Acceptance criteria

### CONSOLE-005-AC1 , Listing editor renders the metadata form
```gherkin
Given the editor is open for a plugin
When the listing page renders
Then it shows the icon, listing details (display name, summary, description), supported languages, keywords, and a visibility toggle
```

### CONSOLE-005-AC2 , Language switcher changes the edited locale
```gherkin
Given the listing editor is rendered with multiple shipped locales
When the user selects a different language in the switcher
Then the form reflects the selected locale and its translated/fallback state banner
```

### CONSOLE-005-AC3 , Save does not yet persist (stub)
```gherkin
Given the user edits listing fields
When the user clicks Save changes
Then the button shows a transient Saved confirmation from local state only
And no metadata is persisted server-side (WIP: persistence not yet built)
```
