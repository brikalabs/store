---
id: SOCIAL-004
title: "Post a comment"
status: done
area: social
group: store
test_mode: unit
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.comments.ts
    - apps/web/src/lib/social.ts
  tests:
    - apps/web/src/lib/social-data.test.ts
---

## Description

A signed-in user posts a comment on a plugin. A comment carries a non-empty body
and an optional parentId, which threads it as a reply to another comment.

## Acceptance criteria

### SOCIAL-004-AC1 , Anonymous request to post a comment is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/comments
Then the response status is 401
And no comment row is created
```

### SOCIAL-004-AC2 , A valid top-level comment is stored
```gherkin
Given a signed-in user and a cached Brika plugin named :name
When the user posts a comment with body "Top question" and no parentId
Then the response status is 200
And the returned comment list contains that comment with its author
```

### SOCIAL-004-AC3 , A reply references its parent comment
```gherkin
Given an existing top-level comment on plugin :name
When a user posts a comment with parentId set to that comment's id
Then the new comment is stored with that parentId
And the comment list contains an entry whose parentId is the top comment's id
```

### SOCIAL-004-AC4 , An invalid comment is rejected
```gherkin
Given a signed-in user
When the user posts a comment with an empty body
Then the response status is 400
And no comment row is created
```

### SOCIAL-004-AC5 , Posting a comment for an unknown package returns not found
```gherkin
Given a signed-in user and a package name that is not a Brika plugin on npm
When the user posts an otherwise valid comment for that name
Then the response status is 404
And no comment row is created
```
