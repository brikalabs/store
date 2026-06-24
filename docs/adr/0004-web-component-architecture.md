# 4. apps/web component architecture

- Status: Accepted
- Date: 2026-06-24
- Deciders: maxscharwath

## Context and problem statement

ADR-0002 fixed the web app's folder layout and ADR-0003 brought the server layer to the registry's
clean-architecture bar (thin routes, stores, services, functional DI). Neither covers the layer that
holds most of the code: the React components under `apps/web/src/components`. The conventions exist
in practice (a `*-page.tsx` orchestrator composing small `*-card` / `*-section` / `*-row` children,
hooks as `use-*`, pure helpers split out for tests) but were unwritten and unenforced, so nothing
stopped a future component from growing into a god-file or burying pure logic inside JSX where it
cannot be unit-tested.

## Decision

Write down the component conventions the app already follows, and enforce the cheap, mechanical part
(naming) the same way the other layers are enforced.

### Feature folders

A feature is a directory under `components/<feature>/`. A `*-page.tsx` is the orchestrator: it owns
the page's state and data wiring and composes presentational children. Children are split by role
and named for it: `*-card.tsx` (a settings or detail card), `*-section.tsx` (a detail-page section),
`*-row.tsx` (a list row). Reference: `components/plugin/manage/` (`manage-plugin-page.tsx` +
`versions-card.tsx`) and `components/plugin/detail/`.

### When to split a file

Split for a reason, never for a line count:

- A file **mixes pure logic with JSX** -> move the pure functions to a sibling `*.ts` and give them
  a `*.test.ts`. The payoff is a testable unit, not a shorter file (a tree builder, a parser, a
  format or validation helper). Reference: `plugin/file-tree.ts`, `hooks/use-name-check.ts`.
- A file holds **two genuinely separable components or concerns** -> give each its own file.
  Reference: `operator/package-version-panel.tsx` split out of the packages page.

Do **not** split a single cohesive component (a multi-step form, a two-pane browser) just because it
is long. Cohesion beats line count: a form that reads top to bottom in one file is easier to follow
than the same form scattered across five.

### Naming (enforced)

- Files are **kebab-case** (`create-plugin-page.tsx`, `file-tree.ts`).
- A component function is **PascalCase**; a `*-page.tsx` has **one** primary exported component.
- A hook lives in `hooks/`, is named `use-*.ts`, and exports a `useX` function.
- Pure, React-free helpers live in a `*.ts` (not `.tsx`).

`architecture/naming.test.ts` checks the file-name rules (kebab components, `use-*` hooks) the same
way it checks the registry's layers.

### Props and types

Props are `Readonly<{ ... }>`. The repo-wide rules still hold: no `any`, no `as` casts, no non-null
`!`; type external responses and narrow them (see CONVENTIONS).

### Data and IO

A component reads data from a `/api/*` route or a `lib/<domain>` read model. It must not import
`@/server/*`, `drizzle-orm`, or `@/server/db/schema` (already enforced by `architecture/web.test.ts`).

### Tests

A pure helper, or the logic behind a hook, ships a colocated `*.test.ts` (model:
`hooks/use-icon-palette.test.ts`, `lib/registry/registry-source.test.ts`). A purely presentational
component needs none.

## Consequences

- The conventions are now discoverable and the naming half is enforced, so the component layer stays
  legible as it grows without a reviewer holding the rules in their head.
- A few components that buried pure logic in JSX were split (the tarball file-tree builder, the
  plugin-name validation, the operator version panel), which is what made that logic testable.
- A full feature-first layout (`features/<x>/{components,hooks,api}`) is still the north star from
  ADR-0002 if the app grows substantially; this ADR is the smaller, current-shape codification.
