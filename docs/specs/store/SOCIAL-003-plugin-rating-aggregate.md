---
id: SOCIAL-003
title: "Plugin rating aggregate"
status: done
area: social
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/lib/social.ts
  tests:
    - apps/web/src/lib/social-data.test.ts
---

## Description

The store maintains a denormalised per-plugin rating average and count, recomputed
from the review rows on every review write. The summary is absent when a plugin
has no reviews.

## Acceptance criteria

### SOCIAL-003-AC1 , The average and count reflect all reviews
```gherkin
Given plugin :name has reviews with ratings 4 and 2
When the rating summary is read
Then it returns average 3 and count 2
```

### SOCIAL-003-AC2 , Editing a review recomputes the average without changing the count
```gherkin
Given plugin :name has two reviews averaging 3 over count 2
When one author edits their review from rating 4 to rating 5
Then the summary count stays 2
And the average becomes 3.5
```

### SOCIAL-003-AC3 , A plugin with no reviews has no summary
```gherkin
Given plugin :name has no reviews
When the rating summary is read
Then the result is undefined
```
