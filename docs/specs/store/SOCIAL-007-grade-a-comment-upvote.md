---
id: SOCIAL-007
title: "Grade a comment (upvote)"
status: done
area: social
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.comments.$commentId.vote.ts
    - apps/web/src/lib/social.ts
  tests:
    - apps/web/src/lib/social.test.ts
---

## Description

A signed-in user toggles an upvote on a comment (the comment "grade"). The vote
is idempotent per (user, comment). A user may not upvote their own comment, and a
deleted comment cannot be upvoted.

## Acceptance criteria

### SOCIAL-007-AC1 , Anonymous upvote is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/comments/:commentId/vote
Then the response status is 401
And no vote is recorded
```

### SOCIAL-007-AC2 , Upvoting then upvoting again toggles the upvote off
```gherkin
Given a signed-in voter and a comment by another author
When the voter upvotes once
Then the comment's upvotes is 1 and the voter's viewerUpvoted is true
When the voter upvotes a second time
Then the comment's upvotes is 0 and the voter's viewerUpvoted is false
```

### SOCIAL-007-AC3 , An author may not upvote their own comment
```gherkin
Given a comment authored by the requesting user
When that user upvotes it
Then the operation is rejected (the route returns 404)
```

### SOCIAL-007-AC4 , Upvoting an unknown comment returns not found
```gherkin
Given a signed-in user
When the user upvotes a commentId that does not exist
Then the route returns 404
```
