# Brika platform - engineering guide

A Bun-workspace monorepo: `apps/web` (marketplace, TanStack Start SSR on Workers), `apps/registry`
(npm-compatible registry Worker), `apps/cli`, and the packages they share. Hexagonal: the domain
core is pure, Cloudflare D1/R2 adapters live at the edge.

This file is the strict, non-negotiable house style. It does not duplicate the deep guides - read
those before touching the area they cover:

- **[docs/di.md](docs/di.md)** - dependency injection (`@brika/di`). The single source of truth.
- **[docs/CONVENTIONS.md](docs/CONVENTIONS.md)** - TypeScript, validation, architecture, markers, style.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - the layers and data flow.
- **[docs/ENGINEERING.md](docs/ENGINEERING.md)** - how we build and ship.
- **[docs/TESTING.md](docs/TESTING.md)** - how we test: naming, the three DI seams, what to test (positive+negative, rollback).
- **[docs/adr/0004-web-component-architecture.md](docs/adr/0004-web-component-architecture.md)** - `apps/web` component/feature conventions (folders, when to split, naming).

## Simplicity is the first rule

We optimize for the *smallest code that correctly solves the problem*, not the most general. Before
adding anything, stop at the first that holds: does it need to exist (YAGNI)? does stdlib/the
platform/an installed dep already do it? can it be one line? Deletion beats addition; boring beats
clever. **No speculative abstraction** - no interface with one implementation, no factory for one
product, no config for a value that never changes, no "for later" scaffolding. If a change's
explanation is longer than the change, the change is too big.

## Non-negotiables

**Architecture**

- The domain core (`@brika/registry-core`) imports only `zod`, `@brika/di`, `node:`/`bun:`, and
  relative paths - enforced by `biome-plugins/boundaries-pure.grit`. No Cloudflare/DB/HTTP in the core.
- Storage and gates are **ports** (interfaces + DI tokens); adapters live in `@brika/store-db` and
  the apps. A handler parses input, builds the identity, calls a service, serializes - **no business
  logic in handlers** (route files are thin: ≤80 lines, export only `Route`).

**Dependency injection** - see [docs/di.md](docs/di.md); follow it exactly, do not invent variants.

- Every injectable (service, store, adapter) is a **constructor-less class** that field-injects:
  `readonly #x = inject(Token)`. Optional seam: `injectOr(Token, default)`.
- Interface port -> `token<T>("Name")` (always named). Map a port to its adapter with
  `{ provide: Port, useClass: Adapter }`. Bind values/seams only in the composition root.
- No `new` of a service/store/adapter outside a composition root or a test helper (`testBed` /
  `makeAdapter`). No reading `cloudflare:workers` `env` outside the composition root.

**TypeScript** - enforced by biome + tsconfig (see CONVENTIONS):

- No `any`. No `as` casts (narrow with control flow / type guards / zod). No non-null `!`.
- Validate untrusted input with zod + `safeParse`. Expected failures return a typed result
  (`{ ok: true, ... } | { ok: false, code, message }`), not a throw.

**Comments & docs**

- Explain the **why, not the what**; match the surrounding density. Delete a comment that restates
  the code. Exported functions, classes, and types get a focused header JSDoc; **field/member docs
  only when they add what the name and type don't** - a gotcha, a distinction, a unit/format, or a
  spec ref. A doc that just re-says the field name (`/** Tarball size in bytes. */` on `size`) is
  noise: drop it, or compress a format hint to a terse trailing `// bytes`.
- Mark intentional gaps with a marker comment (`// @todo:`/`@hack:`/`@unenforced:` ..., reason
  required) so they stay visible to `bun run markers`. Never write a marker tag in prose/doc comments.
- **No em dash (`U+2014`)** anywhere - prose, comments, or strings (enforced). Use commas, colons, parens.

**Tests** - `bun:test`; in-memory fakes for ports, `testBed`/`makeAdapter` for DI, real bun:sqlite
(`makeDb`) for adapters. Non-trivial logic ships with a check.

## Before you call it done

```sh
bun run typecheck    # all workspaces
bun run lint         # biome + no-em-dash + thin-routes
bun test packages apps/registry apps/cli apps/web/src architecture
bun run markers      # confirm any new gap is a tracked marker, not hidden debt
```
