---
id: SOCIAL-005
title: "List comments for a plugin"
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

Anyone may read a plugin's comments. Each entry carries the author, body,
parentId, upvote total, the viewer's own upvote state, created timestamp, an
edited flag and a deleted flag. Comments are ordered oldest first. A deleted
comment's body is returned as "[deleted]".

## Acceptance criteria

### SOCIAL-005-AC1 , Comments are returned with author and threading
```gherkin
Given plugin :name has a top-level comment and a reply to it
When a client sends GET /v1/plugins/:name/comments
Then the response status is 200
And the list contains both comments with author detail
And the reply's parentId points to the top-level comment
```

### SOCIAL-005-AC2 , A deleted comment's body is masked
```gherkin
Given a comment on plugin :name is flagged deleted
When the comments are listed
Then that comment's body is returned as "[deleted]"
And its deleted flag is true
```
