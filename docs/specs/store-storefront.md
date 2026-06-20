# STORE , Storefront & discovery

> The public face of Brika: the server-rendered storefront (home/discover, browse,
> plugin detail, public developer profile) and the machine-readable `/v1` discovery
> JSON contract that backs it. Discovery is a hybrid federation: `@brika/*` packages
> are read from the Brika registry and merged ahead of npm results (deduped by name),
> so the store works before the registry has any content. Store copy (title,
> description, screenshot captions) and the readme/changelog are served per-locale
> with an English fallback, and media (icon, screenshots, localized readme,
> localized store.json) is extracted from the package tarball and cached in R2 for
> registry packages or proxied via jsDelivr for npm packages. This domain excludes
> reviews, comments, and votes (see [SOCIAL](./store-social.md)).

Status legend and the code scheme live in [README](./README.md).

---

## STORE-001 , Home / discover page

- **Status:** [DONE]
- **Area:** Storefront / home
- **Test mode:** manual
- **Traceability:** `apps/web/src/routes/index.tsx` (component + loader), `apps/web/src/lib/registry.ts` (searchPlugins) - `apps/web/e2e/store.spec.ts` (browse/detail coverage; the home rails are manually verified)

The store landing page (`GET /`) loads a page of plugins server-side and presents
discovery rails: a featured plugin, a featured rail, a trending rail, and a
browse-by-capability section. It is the entry point into browse and detail.

**STORE-001-AC1** , Home renders server-side with a page of plugins
```gherkin
Given a visitor requests GET /
When the page is server-rendered
Then the response is 200 HTML
And the loader has fetched a page of plugin summaries (searchPlugins with no query)
And the rendered HTML contains the marketplace headline and a total plugin count
```

**STORE-001-AC2** , Home offers entry points into browse and search
```gherkin
Given the home page is rendered
When the visitor reads the hero
Then there is a link to browse all plugins (/plugins)
And there is a control to search the store
```

**STORE-001-AC3** , Browse-by-capability tiles cover the five capability kinds
```gherkin
Given the home page is rendered
When the visitor reaches the browse-by-capability section
Then there are tiles for Tools, Blocks, Bricks, Sparks, and Pages
```

---

## STORE-002 , Browse all plugins

- **Status:** [DONE]
- **Area:** Storefront / browse
- **Test mode:** e2e
- **Traceability:** `apps/web/src/routes/plugins.index.tsx` (component + loader), `apps/web/src/components/discover-index.tsx` (DiscoverIndex) - `apps/web/e2e/store.spec.ts`

`GET /plugins` lists plugins. With no query it shows the dense discovery index
(filter rail, grid, trending/authors sidebar); with a `?q=` query it shows a
results header, an authors section, and a sorted grid of matching plugins.

**STORE-002-AC1** , Browse without a query renders the discovery index
```gherkin
Given a visitor requests GET /plugins with no q parameter
When the page is server-rendered
Then the response is 200 HTML
And the page shows the "Browse plugins" discovery index
```

**STORE-002-AC2** , A registry-published plugin surfaces in browse results
```gherkin
Given the registry has published @brika/plugin-i18n titled "i18n Toolkit"
When a visitor requests GET /plugins?q=i18n
Then the rendered results contain "i18n Toolkit"
```

**STORE-002-AC3** , A results query shows authors and a result count
```gherkin
Given a query that matches at least one plugin
When a visitor requests GET /plugins?q=<term>
Then the results header shows the query term and a plugin count
And matching authors (up to 3) are shown with a "View profile" link to /developers/<id>
```

**STORE-002-AC4** , No matches shows an empty state
```gherkin
Given a query that matches no plugins
When a visitor requests GET /plugins?q=<term>
Then the page shows a "No plugins found" empty state
```

---

## STORE-003 , Plugin detail page

- **Status:** [DONE]
- **Area:** Storefront / detail
- **Test mode:** e2e
- **Traceability:** `apps/web/src/routes/plugins.$.tsx` (component + loader), `apps/web/src/lib/registry.ts` (getPluginPage) - `apps/web/e2e/store.spec.ts`

`GET /plugins/<name>` renders a plugin's detail: header (icon, title, author,
version, rating, install command), a default Overview tab, and routed tabs for
Permissions, Supply chain, Versions, Reviews, and Discussion. A sidebar with
downloads, metadata, and links persists across tabs.

**STORE-003-AC1** , Detail renders server-side with the install command
```gherkin
Given the registry has published @brika/plugin-i18n
When a visitor requests GET /plugins/@brika/plugin-i18n
Then the response is 200 HTML
And the heading shows the display name "i18n Toolkit"
And the rendered page contains the package name "@brika/plugin-i18n" in the install command
And the Overview readme content is rendered
```

**STORE-003-AC2** , An unknown plugin returns a not-found page
```gherkin
Given no plugin named @brika/does-not-exist exists in the registry or npm
When a visitor requests GET /plugins/@brika/does-not-exist
Then the page renders a not-found state (no detail header)
```

**STORE-003-AC3** , Tabs are routed via the URL and the panel follows
```gherkin
Given the detail page for @brika/plugin-i18n is open on Overview
When the visitor clicks the Versions tab
Then the URL gains ?tab=versions
And the Changelog panel is shown
And the Overview "Capabilities" heading is no longer shown
```

**STORE-003-AC4** , A tab is deep-linkable via SSR
```gherkin
Given a visitor requests GET /plugins/@brika/plugin-i18n?tab=reviews
When the page is server-rendered
Then the Reviews panel is shown directly
```

**STORE-003-AC5** , Overview lists capabilities and translations
```gherkin
Given the detail page Overview tab for a plugin that declares capabilities and locales
When the Overview panel renders
Then a Capabilities section is shown
And a localization section states the number of languages the plugin ships
```

**STORE-003-AC6** , Versions panel badges latest and deprecated, hides yanked
```gherkin
Given @brika/plugin-managed has a latest v1.2.0, a deprecated v1.1.0, and a yanked v1.0.0
When a visitor requests GET /plugins/@brika/plugin-managed?tab=versions
Then v1.2.0 is shown with a "Latest" badge
And v1.1.0 is shown with a "Deprecated" badge
And v1.0.0 (yanked) is not shown
```

**STORE-003-AC7** , Detail shows a real install count and a downloads trend chart
```gherkin
Given @brika/plugin-i18n has recorded installs
When a visitor requests GET /plugins/@brika/plugin-i18n
Then the page shows a numeric install count
And the sidebar shows a "Total downloads" card with a trend chart
```

---

## STORE-004 , Public developer profile

- **Status:** [DONE]
- **Area:** Storefront / profile
- **Test mode:** manual
- **Traceability:** `apps/web/src/routes/developers.$id.tsx` (component + loader), `apps/web/src/lib/registry.ts` (getDeveloperPage) - `apps/web/e2e/store.spec.ts` (maintainer search is covered; the profile page is manually verified)

`GET /developers/<id>` renders a maintainer's public profile: avatar, display name,
verified badge, bio and links, aggregate stats, and a grid of the maintainer's
published plugins. The maintainer's plugins are resolved via a `maintainer:<id>`
search; D1-stored profile edits (bio, display name, website, verification) overlay
the npm-derived base.

**STORE-004-AC1** , Profile renders the maintainer header and stats
```gherkin
Given a maintainer with id <login> has published plugins
When a visitor requests GET /developers/<login>
Then the response is 200 HTML
And the page shows the maintainer display name (or id) and an @<login> handle
And the page shows a plugin count
```

**STORE-004-AC2** , Profile lists the maintainer's published plugins
```gherkin
Given the maintainer <login> has published plugins
When a visitor requests GET /developers/<login>
Then a "Plugins" grid is shown with one card per published plugin
```

**STORE-004-AC3** , A maintainer with no plugins shows an empty state
```gherkin
Given the maintainer <login> has no published Brika plugins
When a visitor requests GET /developers/<login>
Then the page shows a "No published Brika plugins found" message
```

---

## STORE-005 , Discovery: search endpoint

- **Status:** [DONE]
- **Area:** Discovery /v1 / search
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.search.ts` (handler), `apps/web/src/lib/registry.ts` (searchPlugins) - `apps/web/src/lib/registry.test.ts`

`GET /v1/search` is the machine-readable search contract. It validates the query
against `SearchQuery`, returns a list of plugin summaries plus a total, and is
cacheable. It supports free-text queries and field-qualified queries such as
`q=maintainer:<login>`.

**STORE-005-AC1** , Search returns plugins and a total with a cache header
```gherkin
Given a valid request GET /v1/search?q=icon
When the handler runs
Then the response status is 200
And the JSON body has a "plugins" array and a numeric "total"
And the cache-control header is "public, max-age=300"
```

**STORE-005-AC2** , An invalid query is rejected
```gherkin
Given a request GET /v1/search with parameters that fail SearchQuery validation
When the handler runs
Then the response status is 400
And the JSON body is { "error": "Invalid search query" }
```

**STORE-005-AC3** , A maintainer-qualified query scopes results to that maintainer
```gherkin
Given a request GET /v1/search?q=maintainer:<login>
When the handler runs
Then the response status is 200
And the returned plugins are limited to those published by <login>
```

**STORE-005-AC4** , limit and offset paginate the results
```gherkin
Given a request GET /v1/search?q=<term>&limit=<n>&offset=<m>
When the handler runs
Then at most <n> plugins are returned
And the page begins at offset <m>
```

---

## STORE-006 , Discovery: registry capabilities endpoint

- **Status:** [DONE]
- **Area:** Discovery /v1 / capabilities
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.registry.ts` (handler) - `apps/web/e2e/store.spec.ts`, (capabilities shape, not yet built)

`GET /v1/registry` is the contract handshake: a consumer reads it to discover the
store name, contract version, and the set of supported features before calling
other endpoints.

**STORE-006-AC1** , Capabilities advertise the contract version and feature set
```gherkin
Given a request GET /v1/registry
When the handler runs
Then the response status is 200
And the JSON body has a "name", a "contractVersion", and a "features" array
And "features" includes search, plugins, versions, readme, icon, verified, profiles, reviews, and comments
And the cache-control header is "public, max-age=300"
```

---

## STORE-007 , Discovery: plugin detail endpoint

- **Status:** [DONE]
- **Area:** Discovery /v1 / detail
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.ts` (handler), `apps/web/src/lib/registry.ts` (getPluginPage) - `apps/web/src/lib/registry.test.ts`

`GET /v1/plugins/<name>` returns the machine-readable `PluginDetail`. The name is
URL-encoded and may be scoped (`@org/name`). Registry packages resolve first; npm
is the fallback.

**STORE-007-AC1** , Detail returns PluginDetail for a known plugin
```gherkin
Given the plugin @brika/plugin-i18n exists
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n
Then the response status is 200
And the JSON body is a PluginDetail object for that plugin
And the cache-control header is "public, max-age=300"
```

**STORE-007-AC2** , An unknown plugin returns 404
```gherkin
Given no plugin named @brika/does-not-exist exists in the registry or npm
When a client requests GET /v1/plugins/%40brika%2Fdoes-not-exist
Then the response status is 404
And the JSON body is { "error": "Not found" }
```

---

## STORE-008 , Discovery: version history endpoint

- **Status:** [DONE]
- **Area:** Discovery /v1 / versions
- **Test mode:** unit
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.versions.ts` (handler), `apps/web/src/lib/registry.ts` (getPluginVersions) - `apps/web/src/lib/registry.test.ts`

`GET /v1/plugins/<name>/versions` returns the full release history, newest first,
each entry carrying its published date, Brika engine constraint, and deprecation
message (if any).

**STORE-008-AC1** , Versions returns the release history newest-first
```gherkin
Given @brika/plugin-managed has multiple published versions
When a client requests GET /v1/plugins/%40brika%2Fplugin-managed/versions
Then the response status is 200
And the JSON body is an array of versions ordered newest-first
And the cache-control header is "public, max-age=300"
```

**STORE-008-AC2** , Versions for an unknown plugin returns 404
```gherkin
Given no plugin named @brika/does-not-exist exists
When a client requests GET /v1/plugins/%40brika%2Fdoes-not-exist/versions
Then the response status is 404
And the JSON body is { "error": "Not found" }
```

---

## STORE-009 , Hybrid npm + registry federation

- **Status:** [DONE]
- **Area:** Discovery / federation
- **Test mode:** unit
- **Traceability:** `apps/web/src/lib/registry.ts` (searchPlugins, getPluginPage), `apps/web/src/lib/registry-source.ts` (REGISTRY_SCOPE @brika/, registry.brika.dev), `apps/web/src/lib/npm.ts` (searchNpm, getPackument) - `apps/web/src/lib/registry.test.ts`, `apps/web/src/lib/registry-source.test.ts`

Discovery merges two sources: the Brika registry (`@brika/*`, read from
registry.brika.dev) and npm (packages tagged with the `brika` keyword). Registry
plugins are placed first and the merged list is deduplicated by name. Registry is
only consulted for the first page of plain (non field-qualified) queries.

**STORE-009-AC1** , Registry plugins are merged ahead of npm and deduplicated by name
```gherkin
Given a plain query whose first page would return both registry and npm hits
When searchPlugins runs at offset 0
Then registry (@brika/*) plugins appear before npm plugins in the merged list
And a plugin name that appears in both sources appears only once
And the total reflects both sources
```

**STORE-009-AC2** , Field-qualified and paginated queries skip the registry merge
```gherkin
Given a query containing a field qualifier (a ":" such as maintainer:foo) or offset greater than 0
When searchPlugins runs
Then the registry catalog is not merged in for that request
And results come from npm only
```

**STORE-009-AC3** , Registry resolves before npm for a single plugin
```gherkin
Given a name that starts with @brika/
When getPluginPage resolves the plugin
Then the Brika registry is consulted first
And npm is used only as a fallback when the name is not a registry name or is not found there
```

---

## STORE-010 , Localized store copy, readme, and changelog

- **Status:** [DONE]
- **Area:** Storefront / localization
- **Test mode:** e2e
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.readme.ts` (handler), `apps/web/src/lib/registry-source.ts` (resolveStoreLocale), `apps/web/src/lib/manifest-mapping.ts` (pickDocPath, docLocales), `@brika/schema` (StoreLocaleSchema) - `apps/web/e2e/store.spec.ts`

Store copy (title, description, screenshot captions via StoreLocaleSchema) plus the
readme and changelog are served per-locale, with English as the fallback. The
detail page exposes a locale switcher driven by the `?lang=` parameter; the readme
endpoint accepts `?lang=` and resolves the closest available doc.

**STORE-010-AC1** , Localized copy renders for a requested locale
```gherkin
Given @brika/plugin-i18n ships a French store locale
When a visitor requests GET /plugins/@brika/plugin-i18n?lang=fr
Then the rendered page shows the French localized title
```

**STORE-010-AC2** , Locale resolution falls back to English then the first available
```gherkin
Given a plugin declares localized docs as a locale-to-path map
When pickDocPath resolves a requested locale that is not present
Then the English (en) doc path is chosen if present
And otherwise the first declared locale's path is chosen
```

**STORE-010-AC3** , The readme endpoint serves the requested locale
```gherkin
Given @brika/plugin-i18n ships a localized readme
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n/readme?lang=fr
Then the response status is 200
And the JSON body has "readme" (the French markdown, or null if absent) and "filename": "README.md"
And the cache-control header is "public, max-age=300"
```

---

## STORE-011 , Media and asset serving from the tarball

- **Status:** [DONE]
- **Area:** Discovery /v1 / assets
- **Test mode:** e2e
- **Traceability:** `apps/web/src/routes/v1.plugins.$name.v.$version.files.$.ts` (handler), `apps/web/src/routes/v1.plugins.$name.v.$version.[index].ts` (file index), `apps/web/src/lib/registry-assets.ts` (getRegistryAsset, getRegistryFileList) - `apps/web/e2e/store.spec.ts`

For registry (`@brika/*`) packages, assets (icon, screenshots, readme images,
localized store.json, and any tarball file) are extracted from the version's tarball
on first request, cached in R2 (`reg/<name>@<version>/<path>`), and served with the
right content type and a long immutable cache. A version-pinned file index is also
served. Asset paths are validated against directory traversal.

**STORE-011-AC1** , An icon asset is served from the tarball with the right content type
```gherkin
Given @brika/plugin-icon@0.1.0 contains assets/icon.svg
When a client requests GET /v1/plugins/%40brika%2Fplugin-icon/v/0.1.0/files/assets/icon.svg
Then the response status is 200
And the content-type is image/svg+xml
And the body is the SVG from the tarball
And the cache-control header is "public, max-age=31536000, immutable"
```

**STORE-011-AC2** , A text source file is served inline as text
```gherkin
Given @brika/plugin-i18n@0.1.0 contains src/index.ts
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n/v/0.1.0/files/src/index.ts
Then the response status is 200
And the content-type begins with "text/" (not application/octet-stream)
```

**STORE-011-AC3** , A path-traversal asset request is rejected
```gherkin
Given a client requests an asset path that escapes the package root
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n/v/0.1.0/files/%2e%2e/%2e%2e/etc/passwd
Then the response status is 400 or 404 (not 200)
```

**STORE-011-AC4** , The version file index lists files with sizes and integrity
```gherkin
Given @brika/plugin-i18n@0.1.0 is published
When a client requests the version file index for that package and version
Then the response status is 200
And the JSON body has "files", "fileCount", "totalSize", "shasum", and "integrity"
```

**STORE-011-AC5** , Asset endpoints are registry-only
```gherkin
Given a name that is not a @brika/ registry name
When a client requests its version asset or file index
Then the response status is 404
```

---

## STORE-012 , Marketplace redesign: Spotlight vs Console direction

- **Status:** [WIP]
- **Area:** Storefront / redesign
- **Test mode:** manual
- **Traceability:** `apps/web/src/routes/index.tsx` (Direction toggle, DirectionSpotlight, DirectionConsole), `apps/web/src/components/discover-index.tsx` (DiscoverIndex) - , (not yet built)

The home page currently ships both redesign directions behind a visible "Direction"
toggle (`?d=a` Spotlight default, `?d=b` Console). The team has not yet picked a
direction; once chosen it must be carried across browse, detail, and profile, and
the toggle removed. Until then this is a development affordance, not a finished
feature.

**STORE-012-AC1** , The home page exposes a Direction toggle
```gherkin
Given a visitor requests GET /
When the home page renders
Then a "Direction" toggle offers Spotlight (d=a) and Console (d=b)
And with no d parameter the Spotlight direction is shown by default
```

**STORE-012-AC2** , Selecting Console renders the dense discovery direction
```gherkin
Given a visitor requests GET /?d=b
When the home page renders
Then the Console (dense discovery index) layout is shown
```

**STORE-012-AC3** , A direction is chosen and applied platform-wide (pending)
```gherkin
Given the team has picked a single direction
When the redesign is finalized
Then the chosen direction is applied to home, browse, detail, and profile
And the Direction toggle is removed
```

---

## STORE-013 , Verified publisher list signing

- **Status:** [TODO]
- **Area:** Discovery /v1 / verified
- **Test mode:** none
- **Traceability:** `apps/web/src/routes/v1.verified.ts` (handler, returns an empty list) - , (not yet built)

`GET /v1/verified` is the contract endpoint for the curated, signed list of verified
publishers. Today it returns an empty list: the curation data and the Ed25519
signing key are not yet provisioned, though the response shape is already
contract-stable.

**STORE-013-AC1** , The verified endpoint returns a contract-stable list
```gherkin
Given a request GET /v1/verified
When the handler runs
Then the response status is 200
And the JSON body has a "plugins" array (currently empty)
And the cache-control header is "public, max-age=300"
```

**STORE-013-AC2** , The verified list is signed with an Ed25519 key (pending)
```gherkin
Given the curation data and Ed25519 signing key are provisioned
When a client requests GET /v1/verified
Then the returned list contains the curated verified publishers
And the payload carries an Ed25519 signature a client can verify against the published key
```

---

## STORE-014 , Scheduled npm sync (CRON prewarm)

- **Status:** [TODO]
- **Area:** Discovery / sync
- **Test mode:** none
- **Traceability:** `apps/web/wrangler.jsonc` (triggers.crons placeholder; no scheduled handler yet) - , (not yet built)

A scheduled Worker job to periodically refresh the npm-derived catalog (packuments,
download counts) so discovery is warm and fresh without waiting on first-request
fetches. The wrangler config notes where the cron trigger goes, but no `scheduled()`
handler exists yet.

**STORE-014-AC1** , A scheduled job refreshes the npm catalog (pending)
```gherkin
Given a cron trigger is configured and a scheduled() handler exists
When the schedule fires
Then the npm catalog (packuments and download counts) is refreshed
And subsequent discovery requests are served from the warmed data
```
