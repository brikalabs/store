# SOCIAL , Reviews, comments & grading

> The store-owned social layer that sits on top of the npm-derived plugin cache.
> Signed-in GitHub users write reviews (a rating plus a body), post threaded
> comments, and grade each other's contributions with "helpful" votes on reviews
> and upvotes on comments. The store aggregates review ratings into a per-plugin
> summary and owns the editable developer profile data (display name, bio,
> website). Reading is public; writing is gated behind a GitHub OAuth session.
> Author replies to reviews (responses) and comment moderation are specified but
> not yet built.

Status legend and the code scheme live in [README](./README.md).

---

## SOCIAL-001 , Write a review (auth-gated, rating plus body)

- **Status:** [DONE]
- **Area:** Reviews
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.reviews.ts` (POST) , `apps/web/src/lib/social.ts` (upsertReview) - `apps/web/src/lib/social-data.test.ts`

A signed-in user submits one review per plugin: an integer rating 1 to 5, a
required body, an optional title and reviewed version. A second submission by the
same user for the same plugin edits the existing review rather than creating a
new one.

**SOCIAL-001-AC1** , Anonymous request to post a review is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/reviews
Then the response status is 401
And no review row is created
```

**SOCIAL-001-AC2** , A valid review from a signed-in user is stored
```gherkin
Given a signed-in user and a cached Brika plugin named :name
When the user posts a review with rating 4 and body "good"
Then the response status is 200
And the returned review list contains the user's review with rating 4 and body "good"
```

**SOCIAL-001-AC3** , An invalid review is rejected
```gherkin
Given a signed-in user
When the user posts a review with rating 6 (out of the 1 to 5 range) or an empty body
Then the response status is 400
And no review row is created
```

**SOCIAL-001-AC4** , Posting a review for an unknown package returns not found
```gherkin
Given a signed-in user and a package name that is not a Brika plugin on npm
When the user posts an otherwise valid review for that name
Then the response status is 404
And no review row is created
```

**SOCIAL-001-AC5** , A second review by the same user edits the existing one
```gherkin
Given a user has already reviewed plugin :name with rating 4
When the same user posts a review for :name with rating 5, title "Better" and body "great"
Then the plugin still has exactly one review from that user
And that review now has rating 5 and is flagged as edited
```

---

## SOCIAL-002 , List reviews for a plugin

- **Status:** [DONE]
- **Area:** Reviews
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.reviews.ts` (GET) , `apps/web/src/lib/social.ts` (listReviews) - `apps/web/src/lib/social-data.test.ts`

Anyone may read a plugin's reviews. Each entry carries the author (id, login,
optional name and avatar), rating, optional title, body, optional reviewed
version, helpful count, the viewer's own helpful state, created timestamp and an
edited flag. Reviews are ordered newest first.

**SOCIAL-002-AC1** , Reviews are returned newest first with author detail
```gherkin
Given plugin :name has two reviews from different users
When a client sends GET /v1/plugins/:name/reviews
Then the response status is 200
And the list contains both reviews with their author login and rating
And the reviews are ordered by created time descending
```

**SOCIAL-002-AC2** , The viewer's own helpful state is reflected per review
```gherkin
Given a signed-in viewer has marked a review helpful
When that viewer lists the reviews
Then that review's viewerVotedHelpful is true
And a different viewer sees the same helpfulCount but viewerVotedHelpful false
```

---

## SOCIAL-003 , Plugin rating aggregate

- **Status:** [DONE]
- **Area:** Reviews
- **Test mode:** unit
- **Traceability:** `apps/web/src/lib/social.ts` (getRatingSummary, recomputeRating) - `apps/web/src/lib/social-data.test.ts`

The store maintains a denormalised per-plugin rating average and count, recomputed
from the review rows on every review write. The summary is absent when a plugin
has no reviews.

**SOCIAL-003-AC1** , The average and count reflect all reviews
```gherkin
Given plugin :name has reviews with ratings 4 and 2
When the rating summary is read
Then it returns average 3 and count 2
```

**SOCIAL-003-AC2** , Editing a review recomputes the average without changing the count
```gherkin
Given plugin :name has two reviews averaging 3 over count 2
When one author edits their review from rating 4 to rating 5
Then the summary count stays 2
And the average becomes 3.5
```

**SOCIAL-003-AC3** , A plugin with no reviews has no summary
```gherkin
Given plugin :name has no reviews
When the rating summary is read
Then the result is undefined
```

---

## SOCIAL-004 , Post a comment

- **Status:** [DONE]
- **Area:** Comments
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.comments.ts` (POST) , `apps/web/src/lib/social.ts` (addComment) - `apps/web/src/lib/social-data.test.ts`

A signed-in user posts a comment on a plugin. A comment carries a non-empty body
and an optional parentId, which threads it as a reply to another comment.

**SOCIAL-004-AC1** , Anonymous request to post a comment is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/comments
Then the response status is 401
And no comment row is created
```

**SOCIAL-004-AC2** , A valid top-level comment is stored
```gherkin
Given a signed-in user and a cached Brika plugin named :name
When the user posts a comment with body "Top question" and no parentId
Then the response status is 200
And the returned comment list contains that comment with its author
```

**SOCIAL-004-AC3** , A reply references its parent comment
```gherkin
Given an existing top-level comment on plugin :name
When a user posts a comment with parentId set to that comment's id
Then the new comment is stored with that parentId
And the comment list contains an entry whose parentId is the top comment's id
```

**SOCIAL-004-AC4** , An invalid comment is rejected
```gherkin
Given a signed-in user
When the user posts a comment with an empty body
Then the response status is 400
And no comment row is created
```

**SOCIAL-004-AC5** , Posting a comment for an unknown package returns not found
```gherkin
Given a signed-in user and a package name that is not a Brika plugin on npm
When the user posts an otherwise valid comment for that name
Then the response status is 404
And no comment row is created
```

---

## SOCIAL-005 , List comments for a plugin

- **Status:** [DONE]
- **Area:** Comments
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.comments.ts` (GET) , `apps/web/src/lib/social.ts` (listComments) - `apps/web/src/lib/social-data.test.ts`

Anyone may read a plugin's comments. Each entry carries the author, body,
parentId, upvote total, the viewer's own upvote state, created timestamp, an
edited flag and a deleted flag. Comments are ordered oldest first. A deleted
comment's body is returned as "[deleted]".

**SOCIAL-005-AC1** , Comments are returned with author and threading
```gherkin
Given plugin :name has a top-level comment and a reply to it
When a client sends GET /v1/plugins/:name/comments
Then the response status is 200
And the list contains both comments with author detail
And the reply's parentId points to the top-level comment
```

**SOCIAL-005-AC2** , A deleted comment's body is masked
```gherkin
Given a comment on plugin :name is flagged deleted
When the comments are listed
Then that comment's body is returned as "[deleted]"
And its deleted flag is true
```

---

## SOCIAL-006 , Grade a review (helpful vote)

- **Status:** [DONE]
- **Area:** Grading
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.reviews.$reviewId.vote.ts` (POST) , `apps/web/src/lib/social.ts` (toggleReviewHelpful) - `apps/web/src/lib/social.test.ts`

A signed-in user toggles a "helpful" vote on a review. The vote is idempotent per
(user, review): a second call removes it. The review's helpfulCount is refreshed
from the authoritative vote rows. A review's own author may not vote on it.

**SOCIAL-006-AC1** , Anonymous helpful vote is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/reviews/:reviewId/vote
Then the response status is 401
And no vote is recorded
```

**SOCIAL-006-AC2** , Voting then voting again toggles the helpful vote off
```gherkin
Given a signed-in voter and a review by another author
When the voter votes helpful once
Then the review's helpfulCount is 1 and the voter's viewerVotedHelpful is true
When the voter votes helpful a second time
Then the review's helpfulCount is 0 and the voter's viewerVotedHelpful is false
```

**SOCIAL-006-AC3** , An author may not vote on their own review
```gherkin
Given a review authored by the requesting user
When that user votes helpful on it
Then the operation is rejected (the route returns 404)
And the review's helpfulCount stays 0
```

**SOCIAL-006-AC4** , Voting on an unknown review returns not found
```gherkin
Given a signed-in user
When the user votes helpful on a reviewId that does not exist
Then the route returns 404
```

---

## SOCIAL-007 , Grade a comment (upvote)

- **Status:** [DONE]
- **Area:** Grading
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.comments.$commentId.vote.ts` (POST) , `apps/web/src/lib/social.ts` (toggleCommentUpvote) - `apps/web/src/lib/social.test.ts`

A signed-in user toggles an upvote on a comment (the comment "grade"). The vote
is idempotent per (user, comment). A user may not upvote their own comment, and a
deleted comment cannot be upvoted.

**SOCIAL-007-AC1** , Anonymous upvote is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends POST /v1/plugins/:name/comments/:commentId/vote
Then the response status is 401
And no vote is recorded
```

**SOCIAL-007-AC2** , Upvoting then upvoting again toggles the upvote off
```gherkin
Given a signed-in voter and a comment by another author
When the voter upvotes once
Then the comment's upvotes is 1 and the voter's viewerUpvoted is true
When the voter upvotes a second time
Then the comment's upvotes is 0 and the voter's viewerUpvoted is false
```

**SOCIAL-007-AC3** , An author may not upvote their own comment
```gherkin
Given a comment authored by the requesting user
When that user upvotes it
Then the operation is rejected (the route returns 404)
```

**SOCIAL-007-AC4** , Upvoting an unknown comment returns not found
```gherkin
Given a signed-in user
When the user upvotes a commentId that does not exist
Then the route returns 404
```

---

## SOCIAL-008 , Read the developer profile (data layer)

- **Status:** [DONE]
- **Area:** Developer profile
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/api.account.profile.ts` (GET) , `apps/web/src/lib/social.ts` (getDeveloperProfile) - `apps/web/src/lib/social-data.test.ts`

The store owns the developer profile data (display name, bio, website, avatar,
github login, verified flag, plugin count). The signed-in developer reads their
own profile, keyed by their GitHub login. The display name defaults to the
developer id when none has been set. (The profile edit UI lives in CONSOLE; this
spec covers the data and endpoint behaviour only.)

**SOCIAL-008-AC1** , Anonymous profile read is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends GET /api/account/profile
Then the response status is 401
```

**SOCIAL-008-AC2** , The profile defaults to the developer id
```gherkin
Given a developer with id "octo" and no stored profile fields
When the developer profile for "octo" is read
Then the displayName is "octo"
```

**SOCIAL-008-AC3** , A signed-in developer reads their own profile
```gherkin
Given a signed-in developer whose GitHub login is "octo"
When the developer sends GET /api/account/profile
Then the response status is 200
And the body is the profile keyed by "octo"
```

---

## SOCIAL-009 , Update the developer profile (data layer)

- **Status:** [DONE]
- **Area:** Developer profile
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/api.account.profile.ts` (PUT) , `apps/web/src/lib/social.ts` (updateDeveloperProfile) - `apps/web/src/lib/social-data.test.ts`

The signed-in developer updates their own profile display name, bio and website.
The update is an upsert keyed by the developer id, so it creates the profile row
if none exists. The website must be a valid URL and fields have length limits.

**SOCIAL-009-AC1** , Anonymous profile update is rejected
```gherkin
Given no GitHub OAuth session is present on the request
When the client sends PUT /api/account/profile
Then the response status is 401
And no profile field is changed
```

**SOCIAL-009-AC2** , A valid update is persisted and returned
```gherkin
Given a signed-in developer
When the developer sends PUT /api/account/profile with displayName "Octo Cat", bio "Hi" and website "https://o.dev"
Then the response status is 200
And a subsequent read returns displayName "Octo Cat", bio "Hi" and website "https://o.dev"
```

**SOCIAL-009-AC3** , An invalid update is rejected
```gherkin
Given a signed-in developer
When the developer sends PUT /api/account/profile with a website that is not a valid URL
Then the response status is 400
And no profile field is changed
```

---

## SOCIAL-010 , Author response to a review

- **Status:** [TODO]
- **Area:** Reviews
- **Test mode:** none
- **Traceability:** , (not yet built)

A plugin's verified author (developer) replies once to a review, and the reply is
shown attached to that review. This is owned by the CONSOLE developer dashboard
and is not yet built.

**SOCIAL-010-AC1** , A verified author posts a response to a review
```gherkin
Given a verified author of plugin :name and an existing review on :name
When the author posts a response to that review
Then the response is stored and attached to the review
And listing the reviews returns the review together with the author's response
```

**SOCIAL-010-AC2** , Only the plugin's author may respond
```gherkin
Given a signed-in user who is not the verified author of plugin :name
When that user attempts to post a response to a review on :name
Then the operation is rejected with status 403
```

---

## SOCIAL-011 , Comment moderation

- **Status:** [TODO]
- **Area:** Comments
- **Test mode:** none
- **Traceability:** , (not yet built)

An authorised moderator removes (soft-deletes) an abusive comment so its body is
masked in listings, and can act on reported content. This is owned by the CONSOLE
developer dashboard and is not yet built. (The schema already carries a deleted
flag on comments and a reports table.)

**SOCIAL-011-AC1** , A moderator removes a comment
```gherkin
Given an authorised moderator and an existing comment on plugin :name
When the moderator removes that comment
Then the comment is flagged deleted
And listing the comments returns its body as "[deleted]"
```

**SOCIAL-011-AC2** , A non-moderator may not remove another user's comment
```gherkin
Given a signed-in user who is not a moderator and is not the comment's author
When that user attempts to remove the comment
Then the operation is rejected with status 403
And the comment is not changed
```

**SOCIAL-011-AC3** , A reported comment is queued for moderation
```gherkin
Given a signed-in user and a comment they consider abusive
When the user reports the comment with a reason
Then a report row is created with status "open" referencing that comment
```
