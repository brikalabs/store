# 3. BetterAuth for console auth and first-class user profiles

- Status: Accepted
- Date: 2026-06-21
- Deciders: maxscharwath
- Specs: `AUTH-010` .. `AUTH-013`, `USER-001` .. `USER-005`; supersedes-in-plan `AUTH-001`/`AUTH-002`/`AUTH-003` and the gone `STORE-004` (see [docs/specs/auth/](../specs/auth/), [docs/specs/user/](../specs/user/))

## Context and problem statement

Console sign-in today is a hand-rolled, GitHub-only OAuth Authorization Code flow
(`AUTH-001`/`AUTH-002`) on a **stateless signed cookie** session (`AUTH-003`:
`<userId>.<hmac>`), with the user persisted as a `gh_<githubId>` row. Two problems:

1. **Identity is GitHub-locked.** The user row is keyed on the GitHub id, so a second
   provider (Google, GitLab) cannot be added without minting a duplicate identity, and
   there is no account-linking story. Every new provider would mean another bespoke
   initiate/callback pair and more hand-rolled CSRF/session code to get right.
2. **The profile is npm residue.** The retired public profile (`STORE-004`, now gone) was
   keyed on an npm `maintainer:<id>` search and overlaid D1 edits on an **npm-derived
   base**. There is also a `developers` table and a stored `pluginCount` left over from
   that model. The store is now registry-only (no npm federation for discovery), so an
   npm-derived profile is both wrong and dead weight.

We want one durable account that can carry several provider identities, a profile the user
authors (not scraped from npm), and a public page for it.

## Decision drivers

- Multiple sign-in providers (GitHub now; Google/GitLab/etc. later) on one account, with
  account linking, without rebuilding OAuth/CSRF/session plumbing per provider.
- A first-class account as the identity, decoupled from any one provider's id.
- A user-authored profile and a public page for it, with published plugins derived from
  ownership (owned scopes -> catalog), not a stored count or npm data.
- Runs on Cloudflare Workers/D1 (the existing edge stack).
- Do not disturb the registry's CLI device-auth (`AUTH-008`) or token/OIDC publish path
  (trusted publishers, `PUB-016`) - those are a separate concern.

## Considered options

1. **Extend the custom auth.** Keep the hand-rolled flow and add provider abstraction,
   account linking, and a DB-backed session ourselves. Rejected: account linking, CSRF,
   multi-provider callback handling, and session storage are exactly the security-sensitive
   surface that a maintained library gets right; re-implementing it is ongoing risk for no
   differentiation.
2. **BetterAuth with its Drizzle/D1 adapter on Workers.** Provider-agnostic social sign-in,
   built-in account linking, DB-backed sessions in canonical `user`/`session`/`account`/
   `verification` tables, configured for the edge (secrets, trusted origin/CSRF, D1 binding).
3. **A hosted IdP (Auth0/Clerk/etc.).** Rejected: adds a third-party dependency and cost,
   pulls identity off our own D1/Workers stack, and is heavier than needed for console sign-in.

## Decision outcome

Chosen: **option 2, BetterAuth on Workers/D1.**

- **Auth**: provider-agnostic sign-in (`AUTH-010`, GitHub first, pluggable), account linking
  (`AUTH-011`), DB-backed session via the Drizzle/D1 adapter (`AUTH-012`), and the
  Workers-edge configuration + migration (`AUTH-013`). This supersedes `AUTH-001`/`AUTH-002`/
  `AUTH-003` and absorbs who-am-i (`AUTH-005`) and sign-out (`AUTH-006`) into BetterAuth's
  session endpoints. The current `AUTH-001`/`002`/`003` stay `done` (accurate for prod) until
  BetterAuth ships, then retire to `gone`.
- **Identity + profile**: the **account** is the first-class identity with a stable opaque id
  (`USER-001`); the `developers` table and `pluginCount` are dropped (published plugins are
  derived live from owned scopes). The profile is **user-authored, never npm-derived**
  (`USER-005`), edited via the re-framed `CONSOLE-012`/`USER-003`, with link/unlink in
  `USER-004`. The public surface is `store.brika.dev/u/:id` (`USER-002`), keyed by the opaque
  account id (no username/handle, no uniqueness or claim flow), replacing the gone
  `STORE-004` `/developers/:id` page.
- **Out of scope**: the registry CLI device-auth (`AUTH-008`) and token/OIDC publish path
  (`PUB-016`) are unchanged - BetterAuth is console sign-in only.

### Consequences

- A migration that introduces the BetterAuth `user`/`session`/`account`/`verification` tables
  and folds the old `developers`/`gh_<githubId>` user model into the account; existing
  GitHub sign-ins map to a GitHub `account` row on a new account id. Migrations are applied
  out-of-band and are not run on deploy, so the live D1 schema must be verified after the
  deploy.
- Sessions become DB-backed (a `session` row + cookie) instead of a stateless signed cookie;
  sign-out now deletes a row rather than just clearing a cookie.
- A new dependency (BetterAuth) and its edge configuration (auth secret + per-provider
  client id/secret as Worker secrets, trusted origin for CSRF, D1 binding through the
  adapter) replace the `SESSION_SECRET`/`GITHUB_CLIENT_*` config of `AUTH-009`.
- The `/u/:id` page and account profile remove all remaining npm-maintainer residue from the
  identity model; published-plugin lists are computed from ownership at read time.

## Open questions

1. **Email-based auto-link policy** - which providers are trusted enough to auto-link by
   verified email (`AUTH-011-AC1`) versus requiring an explicit signed-in link.
2. **Opaque id format** - the exact shape of the stable account id surfaced in `/u/:id`.
3. **Cutover** - dual-run window, if any, between the hand-rolled flow and BetterAuth before
   `AUTH-001`/`002`/`003` move to `gone`.
