# 5. Frontend component architecture: smart/dumb, logic in hooks, composition over props

- Status: Accepted
- Date: 2026-06-24
- Deciders: maxscharwath

## Context and problem statement

ADR-0004 fixed the component *folder* layout, but not how a component is built inside. In practice many
components weld data logic to rendering: ~24 components call `fetch()` inline and a dozen mix
`fetch` + `useState` + `useEffect` next to 100+ lines of JSX (e.g. the scope settings cards). That logic
is not reusable, not unit-testable, and you cannot read the markup without reading the network code
threaded through it. There are only a handful of reusable hooks. The result reads worse than it should.

## Decision

A component does ONE of two jobs, and its data logic lives in a hook.

### Smart vs dumb

- **Presentational (dumb)**: props in, JSX out. **No `fetch`, no data `useEffect`, no business logic.**
  It may hold *view* state (a controlled input, an open/closed toggle) - state that has no meaning
  outside the render. Most components are this.
- **Container / page (smart)**: owns the data by calling a **hook**, then renders presentational
  components and wires their callbacks. It does not inline fetch/mutation logic.

### Logic lives in reusable hooks

All data fetching, mutations, and derived/async state go in a `use-*` hook under `hooks/` (or beside
the feature). **A component never calls `fetch()` directly.** A hook returns a small, named API:

```ts
const { domains, busy, add, verify, remove } = useScopeDomains(scope, onError);
```

Hooks are reusable across components and **unit-testable** in isolation (model:
`hooks/use-icon-palette.test.ts`, `hooks/use-name-check.test.ts`). Reference refactor:
`use-scope-domains.ts` + `scope/domains-card.tsx` (the card was 207 lines of mixed logic+JSX; now the
hook owns the HTTP and the card is markup).

### Composition over props (the shadcn pattern)

Prefer `children`, slots, and compound components over a long prop list. A presentational component
that needs **more than ~5 props is a smell**: pass `children`, split it, or expose sub-components
(`<Card><Card.Header/>...`) instead of threading `headerTitle`, `headerIcon`, `headerAction`, ... A
prop list you have to scroll is a component doing too much.

### Folders separate logic from render

- `hooks/use-*.ts` - the logic (one hook per data concern), `use-` prefix, exports a `useX`.
- `components/<feature>/` - the dumb pieces and the container that wires them (ADR-0002/0004).
- A pure render helper with no hooks may be a plain function in the same file.

### Minimum logic in a `.tsx`

If a component holds a `fetch`, a multi-step async flow, or a data `useEffect`, that is the signal to
extract a hook. The `.tsx` should read as markup with a few handlers, not as a controller.

## Enforcement

`architecture/naming.test.ts` already requires `hooks/use-*`. A follow-up guard can flag a raw `fetch(`
under `components/**` (data access must go through a hook); it is deferred until the existing
components are migrated, so it lands green rather than as a wall of failures.

## Consequences

- Components become readable as markup; the logic is reusable and tested once in its hook.
- The migration is incremental (one feature at a time): extract the hook, slim the component, leave a
  test on the hook. Behaviour is unchanged (a pure move of logic into a hook).
- A feature-first layout (`features/<x>/{components,hooks}`) remains the north star from ADR-0002 if
  the app grows; this ADR makes each component well-formed regardless of where the folder line lands.
