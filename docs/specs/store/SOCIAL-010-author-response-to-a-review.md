---
id: SOCIAL-010
title: "Author response to a review"
status: todo
area: social
group: store
test_mode: none
traceability:
  code: []
  tests: []
---

## Description

A plugin's verified author (developer) replies once to a review, and the reply is
shown attached to that review. This is owned by the CONSOLE developer dashboard
and is not yet built.

## Acceptance criteria

### SOCIAL-010-AC1 , A verified author posts a response to a review
```gherkin
Given a verified author of plugin :name and an existing review on :name
When the author posts a response to that review
Then the response is stored and attached to the review
And listing the reviews returns the review together with the author's response
```

### SOCIAL-010-AC2 , Only the plugin's author may respond
```gherkin
Given a signed-in user who is not the verified author of plugin :name
When that user attempts to post a response to a review on :name
Then the operation is rejected with status 403
```
