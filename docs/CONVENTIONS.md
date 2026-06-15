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
- **Thin HTTP layer.** Routes parse, build the identity, call a service, and
  serialize. No business logic in handlers.

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
