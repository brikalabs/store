# Brika specifications

Production-ready, code-addressable specifications for the Brika platform (store +
registry + console). Each feature has a stable **code**, a **status**, and
**Gherkin acceptance criteria** that map one-to-one onto automated tests, so you
can answer three questions fast:

1. **Where is the spec for X?** Grep the code, e.g. `rg "SCOPE-003" docs/specs`.
2. **Is it built?** Read the status legend below; the [INDEX](./INDEX.md) is the
   full matrix.
3. **Is it tested / does it still pass?** Run `bun run spec:coverage` , it
   cross-links every acceptance-criterion code to the tests that cite it.

## The code scheme

Every spec and every acceptance criterion has a stable identifier. Codes are
**append-only**: never renumber, never reuse. Retire a spec by setting its status
to `Removed`, do not delete the code.

| Kind | Format | Example |
| --- | --- | --- |
| Spec (feature) | `<AREA>-<NNN>` | `SCOPE-003` |
| Acceptance criterion | `<AREA>-<NNN>-AC<n>` | `SCOPE-003-AC2` |

### Area prefixes

| Prefix | Domain | File |
| --- | --- | --- |
| `AUTH` | Sign-in, sessions, the console auth guard, device approval | [auth.md](./auth.md) |
| `STORE` | Storefront: discover, browse, detail, profiles, search, media/localization | [store-storefront.md](./store-storefront.md) |
| `SOCIAL` | Reviews, comments, votes/grading | [store-social.md](./store-social.md) |
| `REG` | npm-compatible resolve: packument, tarball, catalog, download stats | [registry-resolve.md](./registry-resolve.md) |
| `PUB` | Publish pipeline: OIDC/token, gates, immutability, integrity, scan | [registry-publish.md](./registry-publish.md) |
| `SCOPE` | Scope claim, membership + roles, verified display name, ownership | [registry-scopes.md](./registry-scopes.md) |
| `MANAGE` | Deprecate, yank, operator takedown/restore, publish tokens, device flow | [registry-management.md](./registry-management.md) |
| `HARDEN` | Rate limits, CORS, path-traversal guard, audit log, backups | [registry-hardening.md](./registry-hardening.md) |
| `CONSOLE` | Developer dashboard UI (overview, plugins, scopes, members, profile, tokens) | [console.md](./console.md) |

## Status legend

| Symbol | Status | Meaning |
| --- | --- | --- |
| `[DONE]` | Done | Built and verified (has passing tests, or manually verified where noted). |
| `[WIP]` | In progress | Partially built; see per-criterion notes. |
| `[TODO]` | Planned | Specified, not yet built. |
| `[HOLD]` | Blocked | Specified; blocked on an external dependency (e.g. operator credentials). |
| `[GONE]` | Removed | Was built; intentionally removed. Code retained for history. |

## Anatomy of a spec

See [`_template.md`](./_template.md). Each spec carries a one-line front matter
(status, area, owner, test mode, traceability) and a set of Gherkin acceptance
criteria, each with its own `-AC<n>` code.

## How acceptance criteria become tests

A test "covers" a criterion by **citing its code in the test title**. Example:

```ts
test("SCOPE-003-AC2: claiming a scope owned by another user returns 409", () => {
  // ...
});
```

`bun run spec:coverage` parses every `-AC<n>` code out of `docs/specs/*.md`,
greps the test suites (`**/*.test.ts`, `apps/web/e2e/**/*.spec.ts`) for those
codes, and prints a matrix plus two gap lists:

- **Uncovered criteria**: an `AC` with no test citing it.
- **Status drift**: a spec marked `[DONE]` whose criteria are not all covered, or
  a `[TODO]` spec that unexpectedly has covering tests.

This is the single source of truth for "what is built and still working" , the
matrix is generated, not hand-maintained, so it cannot rot.

## Authoring rules

- Codes are append-only and immutable (see above).
- One criterion = one independently testable behaviour. Keep them atomic so a
  single test maps to a single `AC`.
- Write criteria black-box (observable behaviour: HTTP status, UI state, stored
  data), never implementation detail, so a test can assert them without coupling.
- Fill **Traceability** with the primary code path(s) and the test file, so a
  reader jumps from spec to code to test in one hop.
- Keep prose ASCII (the repo bans the em dash; use a comma, colon, or parentheses).
