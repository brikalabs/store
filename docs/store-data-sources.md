# Store data sources: real vs. mock

What every field on the storefront is backed by today, and what is still a
placeholder. The guiding split:

- **`@brika/*` (registry-hosted) plugins show real data.** They flow through
  `registry-source.ts` from our own registry (catalog, packument, tarball, the
  `/-/v1/downloads` stats endpoint) with **no demo enrichment**.
- **npm-hosted plugins still use placeholders** (`lib/demo.ts`,
  `lib/mock-social.ts`) for the fields npm does not carry, until an npm sync +
  the D1 social/curation tables are wired into the read path.

## Field by field

| Field | Registry plugins | npm plugins | Where missing data would come from |
| --- | --- | --- | --- |
| name / version / description / displayName | ✅ real (manifest) | ✅ real (manifest) | - |
| icon / screenshots | ✅ real (tarball assets) | ✅ real (jsDelivr) | - |
| readme / changelog | ✅ real, localized (tarball) | ✅ real (jsDelivr) | - |
| capabilities (tools/blocks/…) | ✅ real (manifest) | ✅ real (manifest) | - |
| repository / homepage / license | ✅ real | ✅ real | - |
| **integrity (sha512) / shasum** | ✅ real (dist) | ✅ real (npm dist) | - |
| **installs (all-time)** | ✅ real (`reg_downloads`) | ⬜ not shown | npm has no per-package total |
| downloads / week | ✅ real (trailing 7d) | 🟡 demo, or live on detail | npm downloads API (already used on detail) |
| rating (stars on card/header) | ✅ real or empty (no fake) | 🟡 demo (`demoSummary`) | D1 `plugins.rating*`, enriched server-side |
| reviews / comments | ✅ real, empty until written | 🟡 demo (`mock-social`) | D1 `reviews` / `comments` (already real via `/v1`) |
| verified / featured badge | ✅ real (false until curated) | 🟡 demo | D1 `plugins.verified/featured` (curation console) |
| grants / permissions | ✅ real (manifest, hidden if none) | 🟡 demo descriptions | manifest + a grant-spec catalogue |
| languages count | ✅ real readme locales | 🟡 demo (`demoLocales`) | also count bundled `locales/<lang>/store.json` |
| developer profile bio/verified | 🟡 demo (`demoProfile`) | 🟡 demo | D1 `developers` + GitHub link |

## What is still missing (to finish de-mocking)

1. **Ratings + curation in listings/headers** need D1. The browse/detail loaders
   are isomorphic (they run in the browser on navigation) and cannot read D1
   directly. To surface real `plugins.rating*` / `verified` / `featured`, route
   those reads through the server `/v1/search` and `/v1/plugins/:name` handlers
   (which can read D1) and have the loaders fetch them, or enrich the registry
   catalog response with a D1 join. Reviews/comments themselves are already real
   (the sections fetch `/v1/.../reviews` client-side).
2. **npm plugin de-mock** waits on an npm sync job populating the `plugins` cache
   table, after which `demo.ts` / `mock-social.ts` can be deleted (they are
   isolated on purpose; delete the module and the `demo*` / `mock*` calls).
3. **Language count** should union the readme locales with the bundled
   `locales/<lang>/store.json` tags, so a plugin with a single README but
   localized store copy still reports its real language coverage.
4. **Developer profiles** are still `demoProfile`; wire `developers` (bio,
   verified, avatar) once the profile-edit console is connected end to end.

## Tracking the shims

Every synthesized generator carries a `// @mock: <real source>` marker (tracked by
[`brika-markers`](../packages/markers)), so the placeholders are not invisible:
`bun run markers --kind mock` lists each one (file, line, and the real source that
should replace it), and the Brika Markers VSCode extension shows them inline. See
[CONVENTIONS.md](CONVENTIONS.md#tracking-gaps-markers).

## Removing the shims

`lib/demo.ts` and `lib/mock-social.ts` are deliberately isolated. When the items
above are done, delete the two modules and the `demo*` / `mock*` call sites
(`registry.ts`, `plugins.$.tsx`); `bun run markers --kind mock` then returns
nothing for them. Nothing else depends on them.
