# 2. apps/web file architecture (layered, alias-based)

- Status: Accepted
- Date: 2026-06-20
- Deciders: maxscharwath

## Context and problem statement

`apps/web/src` had grown a flat, 44-file `lib/` grab-bag (pure utils, server-only
Cloudflare/D1 code, the registry read model, and React hooks all mixed together, imported
by 60+ files), a flat 20-file `components/` (layout, feature sections, and primitives
intermingled - including two different `PluginCard`s sharing a name), and deep `../../`
relative imports that made any move ripple across dozens of files. This is hard to navigate
and discourages clean boundaries as more features land.

## Decision

A layered, alias-based layout. Imports across directories use the `@/*` → `src/*` path
alias (tsconfig `paths` + a matching Vite `resolve.alias`, so dev/build, `tsgo`, and
`bun test` agree); same-directory imports stay relative (`./x`). The alias makes future
moves cheap - relocating a file only updates its importers' specifier, never its own
imports.

```
apps/web/src/
  routes/     thin route files (file = URL, TanStack); delegate to the layers below
  server/     server-ONLY: Cloudflare bindings + composition root + local D1
              (server-context, blob-store, env, registry-services, console-api,
               registry-identity, require-user, db/). Never import from a client component.
  lib/
    registry/ read model: registry, registry-source, registry-assets, npm,
              listing*, manifest-mapping (isomorphic - HTTP/npm, no bindings)
    auth/     auth, auth-cookies, session, github, device-approval
    social/   social, grants
    *.ts      pure shared utils only: format, http, org-api
  hooks/      React hooks (use-*)
  components/
    clay/     design-system primitives
    layout/   app chrome: site-header/footer, admin-shell, header-search, search-context
    plugin/   plugin cards + detail sections (listing-card, showcase-card, install, …)
    feedback/ error pages/states
    org/      org-management console cards
```

### What goes where

- **`routes/`** is fixed by TanStack file-based routing (folder = URL); it cannot be freely
  reorganized, so the rule is: keep route files thin and push logic into the layers below.
- **`server/`** is the only place that may touch `cloudflare:workers`, the D1 binding, or
  the composition root. A client component importing from `@/server/*` is a smell.
- **`lib/`** is grouped by domain; only genuinely pure/shared utilities live at its root.
- The two `PluginCard`s are now distinct: `components/plugin/listing-card.tsx`
  (`ListingCard`, the browse/home tile) and `components/plugin/showcase-card.tsx`
  (`ShowcaseCard`, the org/developer-profile tile).

### Consequences

- Wide but mechanical migration (~120 files of import rewrites), done as pure moves with no
  behaviour change - `tsgo`, the full test suite, biome, and a dev boot are the safety net.
- A pure feature-first layout (`features/<x>/{components,hooks,api}`) was considered but
  rejected for now: it is a much larger migration and TanStack still forces a separate
  `routes/`, so the layered grouping above captures most of the benefit at a fraction of the
  churn. It remains the north star if the app grows substantially.
- Per-folder barrel `index.ts` files were intentionally skipped to avoid import cycles and
  name-collision ambiguity across IO-heavy modules; the `@/lib/<group>/<file>` paths are
  explicit and already move-resistant via the alias.
