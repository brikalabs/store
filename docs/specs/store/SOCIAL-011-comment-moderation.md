---
id: SOCIAL-011
title: "Comment moderation"
status: todo
area: social
group: store
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

An authorised moderator removes (soft-deletes) an abusive comment so its body is
masked in listings, and can act on reported content. This is owned by the CONSOLE
developer dashboard and is not yet built. (The schema already carries a deleted
flag on comments and a reports table.)

## Acceptance criteria

### SOCIAL-011-AC1 , A moderator removes a comment
```gherkin
Given an authorised moderator and an existing comment on plugin :name
When the moderator removes that comment
Then the comment is flagged deleted
And listing the comments returns its body as "[deleted]"
```

### SOCIAL-011-AC2 , A non-moderator may not remove another user's comment
```gherkin
Given a signed-in user who is not a moderator and is not the comment's author
When that user attempts to remove the comment
Then the operation is rejected with status 403
And the comment is not changed
```

### SOCIAL-011-AC3 , A reported comment is queued for moderation
```gherkin
Given a signed-in user and a comment they consider abusive
When the user reports the comment with a reason
Then a report row is created with status "open" referencing that comment
```
