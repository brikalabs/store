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

## Tracking gaps (markers)

When a spot in the code is *intentionally incomplete*, mark it with a comment so
it never masquerades as finished. The [`brika-markers`](../packages/markers)
engine tracks six built-in **kinds** (edit or extend them in
[`markers.config.json`](../markers.config.json)), each a distinct promise about
what is missing:

| Kind | What it means |
| --- | --- |
| `mock` | Synthesized stand-in **data** shown until the real source is wired (then delete) |
| `stub` | Placeholder **implementation/behaviour** that is not real logic yet |
| `unenforced` | A limit, rule, or contract field **declared before it is enforced** in code |
| `todo` | Planned work **not built yet** |
| `hack` | A deliberate **shortcut** that works but should be revisited |
| `fixme` | A known **defect**: code that is wrong or fragile and needs a real fix |

Write a `// @kind: reason` comment on, or just above, the spot; the reason is
required. For a synthesized value, mark the **function** that produces it (one
marker), not each field it returns.

```ts
maxScopesPerUser: 3, // @unenforced: needs a count port on the metadata store

// @mock: D1 plugins rating / verified / featured
export function demoSummary(plugin) { ... }
```

Markers are comments on purpose: nothing ships to production (no runtime helper),
so they are a dev, CI, and editor concern only. `bun run markers` lists every
marker of every kind (file, line, reason); `bun run markers --kind mock` (or
`bun run unenforced`) filters. It is informational (always exits 0): it exists so
the gap between "declared" and "done" stays visible and reviewable rather than
silently rotting.

> A Biome plugin cannot do this: its GritQL engine only sees string/code nodes,
> not comments (which is also why the em-dash guard is a script, not a plugin).
> The markers engine scans comments directly, and the same parser backs the
> **Brika Markers** VSCode extension (diagnostics, CodeLens, and a tree view), so
> the editor and CI agree on what counts as a marker.

> Do not write the literal tag (`@mock`, `@unenforced`, ...) in prose or doc
> comments inside `.ts`/`.tsx` files, or the scanner reads it as a real marker.
> The tags in this Markdown file are fine: docs are not scanned.

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
