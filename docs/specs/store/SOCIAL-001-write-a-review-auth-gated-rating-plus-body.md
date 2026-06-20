---
id: SOCIAL-001
title: "Write a review (auth-gated, rating plus body)"
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

A signed-in user submits one review per plugin: an integer rating 1 to 5, a
required body, an optional title and reviewed version. A second submission by the
same user for the same plugin edits the existing review rather than creating a
new one.

## Acceptance criteria

### SOCIAL-001-AC1 , Anonymous request to post a review is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/reviews
Then the response status is 401
And no review row is created
```

### SOCIAL-001-AC2 , A valid review from a signed-in user is stored
```gherkin
Given a signed-in user and a cached Brika plugin named :name
When the user posts a review with rating 4 and body "good"
Then the response status is 200
And the returned review list contains the user's review with rating 4 and body "good"
```

### SOCIAL-001-AC3 , An invalid review is rejected
```gherkin
Given a signed-in user
When the user posts a review with rating 6 (out of the 1 to 5 range) or an empty body
Then the response status is 400
And no review row is created
```

### SOCIAL-001-AC4 , Posting a review for an unknown package returns not found
```gherkin
Given a signed-in user and a package name that is not a Brika plugin on npm
When the user posts an otherwise valid review for that name
Then the response status is 404
And no review row is created
```

### SOCIAL-001-AC5 , A second review by the same user edits the existing one
```gherkin
Given a user has already reviewed plugin :name with rating 4
When the same user posts a review for :name with rating 5, title "Better" and body "great"
Then the plugin still has exactly one review from that user
And that review now has rating 5 and is flagged as edited
```
