---
id: SOCIAL-002
title: "List reviews for a plugin"
status: done
area: social
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.reviews.ts
    - apps/web/src/lib/social.ts
  tests:
    - apps/web/src/lib/social-data.test.ts
---

## Description

Anyone may read a plugin's reviews. Each entry carries the author (id, login,
optional name and avatar), rating, optional title, body, optional reviewed
version, helpful count, the viewer's own helpful state, created timestamp and an
edited flag. Reviews are ordered newest first.

## Acceptance criteria

### SOCIAL-002-AC1 , Reviews are returned newest first with author detail
```gherkin
Given plugin :name has two reviews from different users
When a client sends GET /v1/plugins/:name/reviews
Then the response status is 200
And the list contains both reviews with their author login and rating
And the reviews are ordered by created time descending
```

### SOCIAL-002-AC2 , The viewer's own helpful state is reflected per review
```gherkin
Given a signed-in viewer has marked a review helpful
When that viewer lists the reviews
Then that review's viewerVotedHelpful is true
And a different viewer sees the same helpfulCount but viewerVotedHelpful false
```
