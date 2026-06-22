---
description: Review changed code against Brika's house style (simplicity, DI, hexagonal boundaries, comments) and flag AI-slop / over-engineering
argument-hint: "[optional path, PR ref, or 'staged'] (default: working-tree diff vs main)"
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(bun run lint), Bash(bun run typecheck), Bash(bun run markers), Bash(bun run unenforced), Bash(bun test:*), Read, Grep, Glob, Edit
---
Review the change for conformance to this repo's strict house style. This complements `/code-review`
(correctness) and `/ponytail-review` (over-engineering) with the project-specific rules in
**CLAUDE.md**, **docs/di.md**, and **docs/CONVENTIONS.md** - read those first; they are the authority.

Scope: the diff in `$ARGUMENTS`, or `git diff main...HEAD` plus the working tree when empty. Read the
changed files, not just the diff hunks, when context is needed.

Check, in priority order. A finding = `file:line` + the rule broken + the concrete fix.

1. **Simplicity / no slop (highest priority).** Is any of this unnecessary? Flag: an abstraction
   with one caller, a wrapper that only forwards, a factory for one product, config for a constant,
   "for later" scaffolding, a re-export husk, a comment longer than the code it explains, or a
   reimplementation of stdlib / an installed dep. Prefer deletion. If an explanation is longer than
   the code, the code is too big.
2. **DI** (docs/di.md). Injectables are constructor-less and field-inject (`inject(Token)`); optional
   seams use `injectOr`; ports are named `token<T>("Name")`; a port binds to its adapter via
   `useClass`; no `new` of a service/store/adapter outside a composition root or `testBed`/`makeAdapter`;
   no `env` read outside the composition root; no redundant token bound to the same adapter twice.
3. **Hexagonal boundaries.** `@brika/registry-core` imports only zod / `@brika/di` / node|bun /
   relative. No business logic in route handlers (thin: <=80 lines, export only `Route`). Adapters at
   the edge, ports in the core.
4. **Types.** No `any`, no `as` casts, no non-null `!`. Untrusted input validated with zod; expected
   failures returned as `{ ok, ... }` results, not thrown.
5. **Comments & docs.** Why, not what; delete comments that restate code; every new exported API has
   a focused JSDoc; intentional gaps carry a marker comment (`bun run markers`), not silent TODOs; no
   em dash anywhere; a touched package's README/JSDoc still matches the code (our refactors go stale).
6. **Tests.** Non-trivial logic has a check; DI tests use `testBed`/`makeAdapter`, not `new`.

Then run the gates and fold failures in as findings: `bun run lint`, `bun run typecheck`,
`bun run markers`.

Output: findings grouped High / Medium / Low, each with the one-line fix. End with the single most
important thing to change. If `--fix` is in `$ARGUMENTS`, apply the High findings and re-run the
gates; otherwise propose and wait. Do not pad the report - if the change is clean, say so in one line.
