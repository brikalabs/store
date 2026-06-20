---
id: STORE-012
title: "Marketplace redesign: Spotlight vs Console direction"
status: wip
area: store
group: store
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/index.tsx
    - apps/web/src/components/discover-index.tsx
  tests: []
---

## Description

The home page currently ships both redesign directions behind a visible "Direction"
toggle (`?d=a` Spotlight default, `?d=b` Console). The team has not yet picked a
direction; once chosen it must be carried across browse, detail, and profile, and
the toggle removed. Until then this is a development affordance, not a finished
feature.

## Acceptance criteria

### STORE-012-AC1 , The home page exposes a Direction toggle
```gherkin
Given a visitor requests GET /
When the home page renders
Then a "Direction" toggle offers Spotlight (d=a) and Console (d=b)
And with no d parameter the Spotlight direction is shown by default
```

### STORE-012-AC2 , Selecting Console renders the dense discovery direction
```gherkin
Given a visitor requests GET /?d=b
When the home page renders
Then the Console (dense discovery index) layout is shown
```

### STORE-012-AC3 , A direction is chosen and applied platform-wide (pending)
```gherkin
Given the team has picked a single direction
When the redesign is finalized
Then the chosen direction is applied to home, browse, detail, and profile
And the Direction toggle is removed
```
