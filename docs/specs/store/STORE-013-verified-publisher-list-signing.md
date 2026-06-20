---
id: STORE-013
title: "Verified publisher list signing"
status: todo
area: store
group: store
test_mode: none
traceability:
  code:
    - apps/web/src/routes/v1.verified.ts
  tests: []
---

## Description

`GET /v1/verified` is the contract endpoint for the curated, signed list of verified
publishers. Today it returns an empty list: the curation data and the Ed25519
signing key are not yet provisioned, though the response shape is already
contract-stable.

## Acceptance criteria

### STORE-013-AC1 , The verified endpoint returns a contract-stable list
```gherkin
Given a request GET /v1/verified
When the handler runs
Then the response status is 200
And the JSON body has a "plugins" array (currently empty)
And the cache-control header is "public, max-age=300"
```

### STORE-013-AC2 , The verified list is signed with an Ed25519 key (pending)
```gherkin
Given the curation data and Ed25519 signing key are provisioned
When a client requests GET /v1/verified
Then the returned list contains the curated verified publishers
And the payload carries an Ed25519 signature a client can verify against the published key
```
