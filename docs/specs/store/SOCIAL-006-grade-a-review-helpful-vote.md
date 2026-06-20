---
id: SOCIAL-006
title: "Grade a review (helpful vote)"
status: done
area: social
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.reviews.$reviewId.vote.ts
    - apps/web/src/lib/social.ts
  tests:
    - apps/web/src/lib/social.test.ts
---

## Description

A signed-in user toggles a "helpful" vote on a review. The vote is idempotent per
(user, review): a second call removes it. The review's helpfulCount is refreshed
from the authoritative vote rows. A review's own author may not vote on it.

## Acceptance criteria

### SOCIAL-006-AC1 , Anonymous helpful vote is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/reviews/:reviewId/vote
Then the response status is 401
And no vote is recorded
```

### SOCIAL-006-AC2 , Voting then voting again toggles the helpful vote off
```gherkin
Given a signed-in voter and a review by another author
When the voter votes helpful once
Then the review's helpfulCount is 1 and the voter's viewerVotedHelpful is true
When the voter votes helpful a second time
Then the review's helpfulCount is 0 and the voter's viewerVotedHelpful is false
```

### SOCIAL-006-AC3 , An author may not vote on their own review
```gherkin
Given a review authored by the requesting user
When that user votes helpful on it
Then the operation is rejected (the route returns 404)
And the review's helpfulCount stays 0
```

### SOCIAL-006-AC4 , Voting on an unknown review returns not found
```gherkin
Given a signed-in user
When the user votes helpful on a reviewId that does not exist
Then the route returns 404
```
