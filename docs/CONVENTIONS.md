# Code conventions

These are enforced by `biome.json` and `tsconfig.base.json` where possible, and
followed by review otherwise. Run `bun run lint`, `bun run typecheck`, and
`bun test` before pushing.

## TypeScript

- **No `any`.** Enforced (`suspicious/noExplicitAny`). Type external data with
  zod and parse it.
- **No `as` type casts.** Narrow with control flow, type guards, or zod instead.
  (`as const` is fine; a cast to a specific type is not.)
- **No non-null assertions (`!`).** Enforced (`style/noNonNullAssertion`). Handle
  the nullish case (`?.`, `??`, an early return).
- **`import type` / `export type`** for type-only imports and exports. Enforced
  (`useImportType`, `useExportType`) and required by `verbatimModuleSyntax`.
- **`noUncheckedIndexedAccess`** is on: indexing yields `T | undefined`, handle it.
- **Readonly props.** Component props and value-object fields are `Readonly<...>`
  or `readonly`.

## Validation

- **zod, not hand-rolled guards.** Prefer a schema + `safeParse` over chains of
  `typeof` / `in`. Discriminating an already-parsed union with `typeof` is fine;
  validating untrusted input with it is not.
- **Typed results over throwing** for expected failures: return
  `{ ok: true, ... } | { ok: false, code, message }` (see `PublishService`).

## Architecture

- **Hexagonal.** `@brika/registry-core` has no Cloudflare or framework imports;
  storage and gates are **ports** (interfaces). Cloudflare D1/R2 **adapters** and
  the HTTP layer live in the apps. This keeps the domain pure and unit-testable.
- **Boundaries are enforced.** The pure packages (`registry-core`, `contract`,
  `schema`, `env`) are guarded by one Biome plugin, `biome-plugins/boundaries-pure.grit`,
  scoped to them in `biome.json` via `plugins[].includes`. It is an **allowlist**:
  a pure package may import only relative paths, `node:`/`bun:` builtins, and
  `zod`. Anything else (Cloudflare, a DB driver, an ORM, an HTTP framework, an
  app, or another `@brika` package) fails `biome check` and shows inline in the
  editor, with no denylist to maintain. To allow a new dependency, add it to the
  `or { ... }` allowlist in the plugin and to the package's `package.json`.
- **Thin HTTP layer.** Routes parse, build the identity, call a service, and
  serialize. No business logic in handlers.

## Tracking gaps (`@unenforced`)

When a limit, rule, or contract field is *declared* before it is *enforced*, mark
the spot so it never masquerades as a guarantee. Prefer the **typed marker** when
there is a value to wrap, the **comment** when there is not.

```ts
// Typed marker (real, compiler-visible, IDE find-references, reason required):
import { unenforced } from "@brika/registry-core";
maxFileBytes: unenforced(8 * MiB, "needs tar inspection in the manifest gate"),

// Comment form, for a gap with no value to wrap (e.g. a missing check):
// @unenforced: weekly publish window is not rate-limited yet
```

`unenforced()` is the identity function at runtime, so it changes nothing except
making the gap explicit and searchable. `bun run unenforced` lists every marker
of both forms (file, line, reason). It is informational (always exits 0): it
exists so the gap between "declared" and "enforced" stays visible and reviewable
rather than silently rotting.

> A Biome plugin cannot do this: its GritQL engine only sees string/code nodes,
> not comments (which is also why the em-dash guard is a script, not a plugin).
> The typed `unenforced()` helper is the "real annotation" equivalent, and it
> needs no plugin: the compiler and IDE find every call natively.

## Composition root (wiring)

- **No DI container.** Dependencies are wired by hand in a per-request
  composition root (`apps/registry/src/services.ts` `buildServices`, the web
  `serverContext()`), then passed to handlers as a typed object. Handlers never
  reach for the ambient `env`; the composition root is the single place bindings
  are read. This keeps wiring explicit and handlers testable with fakes, with no
  runtime/bundle cost on the Worker isolate.
- **One source per service: the factory.** `Services` is
  `ReturnType<typeof buildServices>`, inferred from the returned object, so adding
  a service is a single entry in that object (its type flows into every handler);
  there is no parallel interface to keep in sync.
- **Why not a container** (tsyringe / Inversify / Awilix): evaluated and rejected.
  On a stateless Worker isolate a container buys nothing the composition root does
  not (the graph is built per request regardless), while costing reflect-metadata
  cold-start (tsyringe), runtime resolution and ~37 transitive deps (Awilix), and
  a second wiring to keep in sync. A typed factory is simpler and strictly safer.

## Style

Enforced by biome: 2-space indent, LF, 100-col, double quotes, organized imports,
`node:` import protocol, template literals over concatenation, no useless `else`,
collapsed `else if`, no parameter reassignment, no unused imports or variables.

- **No em dash (`—`)** anywhere, prose, comments, or strings. Use commas, colons,
  or parentheses.
- **Comments** explain the *why*, not the *what*. Match the surrounding density.

## UI (store app)

- `@brika/clay` is the UI kit; use its components and tokens.
- Use Clay `Kbd`/`KbdGroup` for keyboard chords, never plain text.
- Icons are `lucide-react` components, never emoji strings.
- Tailwind class strings stay inline per component, not extracted to shared
  constants.

## Tests

- `bun test`, with `*.test.ts` colocated next to the source.
- Test pure logic directly; inject in-memory fakes for ports (no live Cloudflare
  needed). Security-critical code (integrity, OIDC, the publish gates) has
  explicit positive and negative cases.
