# Brika specifications

Code-addressable, docs-as-code specifications for the Brika platform. Each feature
is **one markdown file** whose name is its code, carrying machine-readable YAML
frontmatter and Gherkin acceptance criteria. Three questions, answered fast:

1. **Where is the spec for X?** The code is the filename:
   `rg --files docs/specs | rg SCOPE-003`, or open `docs/specs/<group>/<CODE>-*.md`.
2. **Is it built?** The frontmatter `status`. The generated [INDEX](./INDEX.md) is
   the whole matrix; `bun run spec:index` regenerates it.
3. **Is it tested / still passing?** `bun run spec:coverage` cross-links every
   acceptance-criterion code to the tests that cite it.

Architecture decisions live in the [ADR log](../adr/README.md), not here.

## Folder layout

```
docs/specs/
  README.md            # this handbook
  INDEX.md             # GENERATED registry (do not hand-edit)
  _template.md         # copy this to add a spec
  auth/                # AUTH-*
  store/               # STORE-*, SOCIAL-*
  registry/            # REG-*, PUB-*, SCOPE-*, MANAGE-*, HARDEN-*
  console/             # CONSOLE-*
  org/                 # ORG-*
  user/                # USER-*
```

One file per spec: `docs/specs/<group>/<CODE>-<kebab-title>.md`.

## The code scheme

Stable, **append-only** identifiers. Never renumber, never reuse. Retire a spec by
setting `status: gone`, do not delete its file's code.

| Kind | Format | Example |
| --- | --- | --- |
| Spec (feature) | `<AREA>-<NNN>` | `SCOPE-003` |
| Acceptance criterion | `<AREA>-<NNN>-AC<n>` | `SCOPE-003-AC2` |

Area prefixes: `AUTH`, `STORE`, `SOCIAL`, `REG`, `PUB`, `SCOPE`, `MANAGE`,
`HARDEN`, `CONSOLE`, `ORG`, `USER`.

## Spec file format

YAML frontmatter, then `## Description` and `## Acceptance criteria`:

```markdown
---
id: SCOPE-003
title: "Claim a scope owned by another (conflict)"
status: done            # done | wip | todo | hold | gone
area: scope             # the AREA prefix, lowercased
group: registry         # the folder it lives in
test_mode: unit         # unit | e2e | manual | none
traceability:
  code:
    - apps/registry/src/controllers/scope.ts
  tests:
    - apps/registry/src/controllers/handlers.test.ts
---

## Description

A scope already owned by another identity cannot be claimed.

## Acceptance criteria

### SCOPE-003-AC1 , claiming another's scope is refused
` ` `gherkin
Given "@acme" is owned by another user
When I claim "@acme"
Then I get a 409 conflict
` ` `
```

Write criteria black-box (observable: HTTP status, UI state, stored data), atomic
(one criterion = one test), and ASCII (the repo bans the em dash; use a comma,
colon, or parentheses).

## Status values

| `status` | Meaning |
| --- | --- |
| `done` | Built and verified (tests, or manually verified where noted). |
| `wip` | Partially built. |
| `todo` | Specified, not built. |
| `hold` | Specified; blocked on an external dependency (e.g. operator credentials). |
| `gone` | Was built; intentionally removed. File + code retained for history. |

## Adding or changing a spec

1. `cp docs/specs/_template.md docs/specs/<group>/<CODE>-<slug>.md`.
2. Fill the frontmatter and the Gherkin criteria.
3. `bun run spec:index` to regenerate `INDEX.md`.
4. When you write the test, put the AC code in its title (see below).

## How acceptance criteria become tests

A test "covers" a criterion by citing its code in the title:

```ts
test("SCOPE-003-AC1: claiming a scope owned by another returns 409", () => {
  // ...
});
```

- `bun run spec:coverage` , prints a coverage matrix + two gap lists (uncovered
  criteria; status drift, e.g. a `done` spec with no covering test).
- `bun run spec:coverage --strict` , non-zero exit on drift, for CI.

The declared `status` and the verified coverage are intentionally separate: specs
are first authored from the implemented code, then the test suites are annotated
with their AC codes, so coverage climbs over time without the docs rotting.

## Tooling

| Script | What it does |
| --- | --- |
| `scripts/spec-lib.ts` | Shared loader (frontmatter + AC codes). |
| `scripts/spec-lint.ts` (`spec:lint`) | Validates structure: frontmatter, code/filename/area/group match, AC sequence, fences, duplicate ids. Fails on error. |
| `scripts/gen-spec-index.ts` (`spec:index`) | Regenerates `INDEX.md`; `--check` fails if stale. |
| `scripts/spec-coverage.ts` (`spec:coverage`) | Test-linkage matrix + drift; `--strict` for CI. |
| `spec:check` | `spec:lint` + `spec:index --check` + `spec:coverage`. Runs in CI. |
