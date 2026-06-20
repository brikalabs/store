# Store data sources: real vs. mock

What every field on the storefront is backed by today, and what is still a
placeholder. The storefront is **registry-only**: every listed plugin is a
verified, scoped plugin published to the Brika registry, read through
`registry-source.ts` (catalog, packument, tarball, the `/-/v1/downloads` stats
endpoint) with **no demo enrichment**. npm is not a listing or discovery source
(npm `bun/npm install` consumption still resolves, but it is never read for the
store), so there is no npm-derived row to de-mock.

## Field by field

| Field | Source |
| --- | --- |
| name / version / description / displayName | ✅ real (manifest) |
| icon / screenshots | ✅ real (tarball assets) |
| readme / changelog | ✅ real, localized (tarball) |
| capabilities (tools/blocks/…) | ✅ real (manifest) |
| repository / homepage / license | ✅ real |
| **integrity (sha512) / shasum** | ✅ real (dist) |
| **installs (all-time)** | ✅ real (`reg_downloads`) |
| downloads / week | ✅ real (trailing 7d) |
| rating (stars on card/header) | ✅ real or empty (no fake) |
| reviews / comments | ✅ real, empty until written (D1 via `/v1`) |
| verified / featured badge | ✅ real (false until curated) |
| grants / permissions | ✅ real (manifest, hidden if none) |
| languages count | ✅ real readme locales |
| publisher (scope / org display name + verified) | ✅ real (registry publisher) |

## What is still missing

1. **Ratings + curation in listings/headers** need D1. The browse/detail loaders
   are isomorphic (they run in the browser on navigation) and cannot read D1
   directly. To surface real `plugins.rating*` / `verified` / `featured`, route
   those reads through the server `/v1/search` and `/v1/plugins/:name` handlers
   (which can read D1) and have the loaders fetch them, or enrich the registry
   catalog response with a D1 join. Reviews/comments themselves are already real
   (the sections fetch `/v1/.../reviews` client-side).
2. **Language count** should union the readme locales with the bundled
   `locales/<lang>/store.json` tags, so a plugin with a single README but
   localized store copy still reports its real language coverage.

## Tracking the shims

Any remaining synthesized generator carries a `// @mock: <real source>` marker
(tracked by [`brika-markers`](../packages/markers)), so placeholders are not
invisible: `bun run markers --kind mock` lists each one (file, line, and the real
source that should replace it), and the Brika Markers VSCode extension shows them
inline. See [CONVENTIONS.md](CONVENTIONS.md#tracking-gaps-markers).
