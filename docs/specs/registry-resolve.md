# REG , npm-compatible resolve, catalog & stats

> The open read surface of the Brika registry: everything a client needs to
> install a package. It speaks the npm read protocol (full and abbreviated
> packuments, tarball downloads) so `bun`/`npm`/`pnpm` install straight from it,
> adds a small catalog endpoint (npm has none) so the storefront can enumerate
> `@brika/*` plugins, and exposes per-package download stats. Reads are anonymous,
> CORS-frontable, and freely cacheable; there is no rate limit on this surface.
> Yanked and operator-taken-down versions are hidden from resolve and catalog.
> Tarball origins are pinned to the configured `REGISTRY_URL`, not the request
> `Host`, and a served tarball's SHA-512 matches the integrity the publisher
> recorded, so `name@version` is immutable and verifiable.

Status legend and the code scheme live in [README](./README.md).

---

## REG-001 , Fetch full packument

- **Status:** [DONE]
- **Area:** Resolve / packument
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/packument.ts` (buildPackument) , `apps/registry/src/controllers/packages.ts` (packument handler) - `packages/registry-core/src/packument.test.ts`

`GET /:name` (scoped or unscoped) returns the npm-shaped full packument: every
visible version, dist-tags, publish times, and per-version `dist` (tarball URL,
integrity, shasum). Unknown packages are a clean 404.

**REG-001-AC1** , 200 with full packument document
```gherkin
Given a published package "@brika/plugin-weather" with versions 1.0.0 and 1.1.0
When a client sends GET /@brika/plugin-weather with no special Accept header
Then the response status is 200
And the Content-Type is "application/json"
And the body "name" equals "@brika/plugin-weather"
And the body has a "dist-tags" object and a "versions" object keyed by version string
And "versions" contains keys "1.0.0" and "1.1.0"
```

**REG-001-AC2** , each version carries a complete dist block
```gherkin
Given the full packument for "@brika/plugin-weather"
When the client reads versions["1.1.0"].dist
Then "dist.tarball" is an absolute URL ending "/@brika/plugin-weather/-/plugin-weather-1.1.0.tgz"
And "dist.integrity" is a string of the form "sha512-<base64>"
And "dist.shasum" is a SHA-1 hex string
```

**REG-001-AC3** , publish times are present
```gherkin
Given the full packument for "@brika/plugin-weather"
When the client reads the "time" object
Then "time.created" is an ISO 8601 timestamp
And "time.modified" is an ISO 8601 timestamp
And "time" contains an ISO 8601 timestamp keyed by each visible version
```

**REG-001-AC4** , unknown package is 404
```gherkin
Given no package named "@brika/does-not-exist" exists
When a client sends GET /@brika/does-not-exist
Then the response status is 404
```

---

## REG-002 , Fetch abbreviated packument

- **Status:** [DONE]
- **Area:** Resolve / packument
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/packument.ts` (abbreviated projection) , `apps/registry/src/controllers/packages.ts` (packument handler) - `packages/registry-core/src/packument.test.ts`

When a client sends `Accept: application/vnd.npm.install-v1+json` (what `bun` and
`npm` send on install), the same route returns the smaller install metadata:
install-relevant manifest fields only, no readme or full scripts, and the
response varies by `Accept` so caches key on it.

**REG-002-AC1** , abbreviated content type and trimmed shape
```gherkin
Given a published package "@brika/plugin-weather"
When a client sends GET /@brika/plugin-weather with Accept "application/vnd.npm.install-v1+json"
Then the response status is 200
And the Content-Type is "application/vnd.npm.install-v1+json"
And the body has "name", "dist-tags", "versions", and a "modified" timestamp
And the body has no "time" object, no "readme", and no "publisher" field
```

**REG-002-AC2** , per-version fields are limited to install metadata
```gherkin
Given the abbreviated packument for "@brika/plugin-weather"
When the client reads a version entry
Then it contains "dist" (tarball, integrity, shasum)
And it contains only install-relevant manifest fields (dependencies, peerDependencies, optionalDependencies, bin, engines, os, cpu, directories, funding and similar)
And it contains a boolean "hasInstallScript" that is true only when the manifest has an install, preinstall, or postinstall script
And it does not contain "readme" or the full "scripts" object
```

**REG-002-AC3** , response varies by Accept
```gherkin
Given the registry serves both packument forms on the same path
When a client inspects the response to GET /@brika/plugin-weather
Then the response includes the header "Vary: accept"
```

---

## REG-003 , Dist-tag resolution

- **Status:** [DONE]
- **Area:** Resolve / dist-tags
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/packument.ts` (dist-tags assembly) , `packages/registry-core/src/resolve.ts` (ResolveService) - `packages/registry-core/src/packument.test.ts`

The packument's `dist-tags` object maps tag names to version strings, so a client
can resolve `latest` (and any custom tag) to a concrete version.

**REG-003-AC1** , latest resolves to the published latest version
```gherkin
Given "@brika/plugin-weather" has 1.0.0 and 1.1.0 with the "latest" tag on 1.1.0
When a client reads "dist-tags" from the packument
Then "dist-tags.latest" equals "1.1.0"
```

**REG-003-AC2** , custom tags are surfaced
```gherkin
Given "@brika/plugin-weather" has a "next" tag pointing at 1.0.0
When a client reads "dist-tags" from the packument
Then "dist-tags.next" equals "1.0.0"
```

---

## REG-004 , Download tarball

- **Status:** [DONE]
- **Area:** Resolve / tarball
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/packages.ts` (tarball handler), `apps/registry/src/adapters/r2-tarball.ts` (R2TarballReader) - `apps/registry/src/controllers/packages.test.ts`

`GET /:name/-/:file` streams the immutable tarball bytes from object storage. The
filename must parse to a known `name@version`; otherwise it is a 404. Tarballs are
content-immutable, so they are cacheable forever.

**REG-004-AC1** , 200 streams the tarball with octet-stream content type
```gherkin
Given the tarball for "@brika/plugin-weather@1.1.0" exists in storage
When a client sends GET /@brika/plugin-weather/-/plugin-weather-1.1.0.tgz
Then the response status is 200
And the Content-Type is "application/octet-stream"
And the body is the raw tarball bytes
```

**REG-004-AC2** , tarballs are cached as immutable
```gherkin
Given a successful tarball download
When the client inspects the response headers
Then the Cache-Control is "public, max-age=31536000, immutable"
```

**REG-004-AC3** , unparseable filename is 404
```gherkin
Given a client requests a file that does not match "<name>-<version>.tgz"
When a client sends GET /@brika/plugin-weather/-/garbage.tgz
Then the response status is 404
```

**REG-004-AC4** , missing tarball bytes are 404
```gherkin
Given "@brika/plugin-weather@9.9.9" has no bytes in object storage
When a client sends GET /@brika/plugin-weather/-/plugin-weather-9.9.9.tgz
Then the response status is 404
```

---

## REG-005 , Served tarball integrity matches recorded integrity

- **Status:** [DONE]
- **Area:** Resolve / integrity
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/integrity.ts` (sha512Integrity, sha1Hex), `packages/registry-core/src/packument.ts` (dist block) - `packages/registry-core/src/integrity.test.ts`

The integrity advertised in the packument is the integrity of the bytes served, so
a client's verification (the same check `bun` performs on install) passes and
`name@version` is immutable. Proven end to end: `bun add @brika/plugin-weather`
installs from the registry.

**REG-005-AC1** , downloaded bytes hash to the advertised integrity
```gherkin
Given the packument advertises dist.integrity for "@brika/plugin-weather@1.1.0"
When a client downloads the tarball at dist.tarball and computes its SHA-512 integrity
Then the computed "sha512-<base64>" equals the advertised dist.integrity
And the computed SHA-1 hex equals the advertised dist.shasum
```

**REG-005-AC2** , a given name@version always serves identical bytes
```gherkin
Given a tarball has been published for "@brika/plugin-weather@1.1.0"
When the same name@version is downloaded again at any later time
Then the bytes are byte-for-byte identical
And the integrity continues to match the originally recorded value
```

---

## REG-006 , Record a download on tarball fetch

- **Status:** [DONE]
- **Area:** Resolve / download counting
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/packages.ts` (tarball handler, waitUntil), `packages/db/src/adapters/d1-downloads.ts` (per-day buckets) - `apps/registry/src/controllers/packages.test.ts`

A served tarball is an install signal. The count is incremented off the response
path (via `waitUntil`), so the download never waits on or fails from the counter,
and edge-cached repeats that skip the Worker are uncounted (counts are a lower
bound, as on npm). Counts bucket per UTC day.

**REG-006-AC1** , a successful download increments today's count
```gherkin
Given the download count for "@brika/plugin-weather" on the current UTC day is N
When a client successfully downloads a tarball for that package
Then the count for that package on the current UTC day becomes N + 1
```

**REG-006-AC2** , counting never blocks or fails the download
```gherkin
Given the download counter would error or be slow
When a client downloads a tarball
Then the response status is still 200 and the bytes are still served
```

**REG-006-AC3** , a 404 download does not record a count
```gherkin
Given a tarball request that resolves to 404
When the request completes
Then no download count is recorded for that package
```

---

## REG-007 , Yanked and taken-down versions hidden from resolve

- **Status:** [DONE]
- **Area:** Resolve / visibility
- **Test mode:** unit
- **Traceability:** `packages/registry-core/src/packument.ts` (visibility filter), `packages/db/src/adapters/d1-metadata.ts` (D1MetadataReader.getPackage) - `packages/registry-core/src/packument.test.ts`, `apps/registry/src/controllers/handlers.test.ts`

Yanked versions (publisher action) and taken-down versions (operator action) do
not appear in the packument's `versions` map, so clients cannot resolve or install
them. A taken-down version's reason is surfaced under a non-standard `takedowns`
field for transparency.

**REG-007-AC1** , a yanked version is absent from the packument
```gherkin
Given "@brika/plugin-weather" has versions 1.0.0 and 1.1.0 and 1.1.0 is yanked
When a client fetches the packument
Then "versions" contains "1.0.0"
And "versions" does not contain "1.1.0"
```

**REG-007-AC2** , a taken-down version is hidden but its reason is disclosed
```gherkin
Given "@brika/plugin-weather@1.0.0" has been taken down with reason "malware"
When a client fetches the packument
Then "versions" does not contain "1.0.0"
And "takedowns"["1.0.0"] equals "malware"
```

**REG-007-AC3** , a package with no visible versions still resolves with empty versions
```gherkin
Given every version of "@brika/plugin-weather" is yanked or taken down
When a client fetches the packument
Then the response status is 200
And "versions" is an empty object
```

---

## REG-008 , Catalog list with pagination and text search

- **Status:** [DONE]
- **Area:** Catalog
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/catalog.ts` (handleCatalog), `packages/db/src/adapters/d1-catalog.ts` (CatalogReader) - `apps/registry/src/controllers/handlers.test.ts`

`GET /-/v1/packages` is Brika's addition to the npm protocol (which has no list
endpoint), so the storefront can enumerate plugins. It returns each package's
latest visible version with its publisher and download stats, paginated and
optionally filtered by free text.

**REG-008-AC1** , 200 with packages array and total count
```gherkin
Given two published packages exist
When a client sends GET /-/v1/packages
Then the response status is 200
And the body has a "packages" array and a numeric "total"
And each "packages" entry has "name", "version", "manifest", and "publishedAt"
```

**REG-008-AC2** , entries carry verified publisher and download stats
```gherkin
Given a published package owned by a claimed, verified scope
When a client reads its entry in the catalog response
Then the entry has "publisher" with "id", "name", and "verified" equal to true
And the entry has "downloads" with numeric "total" and "weekly"
```

**REG-008-AC3** , limit defaults to 50 and is clamped to 1..250
```gherkin
Given more than 250 published packages exist
When a client sends GET /-/v1/packages with no limit
Then at most 50 entries are returned
When a client sends GET /-/v1/packages?limit=1000
Then at most 250 entries are returned
When a client sends GET /-/v1/packages?limit=0
Then at least 1 entry is returned
```

**REG-008-AC4** , offset paginates and total is the unpaginated match count
```gherkin
Given 3 published packages match the query
When a client sends GET /-/v1/packages?limit=2&offset=2
Then the "packages" array contains the 3rd matching entry only
And "total" equals 3
```

**REG-008-AC5** , text search matches name, displayName, description, and keywords
```gherkin
Given a package whose manifest description contains "weather"
And a package with no "weather" in any searched field
When a client sends GET /-/v1/packages?text=WEATHER
Then only the weather package appears in "packages"
And the match is case-insensitive across name, displayName, description, and keywords
```

---

## REG-009 , Catalog excludes yanked and taken-down packages

- **Status:** [DONE]
- **Area:** Catalog / visibility
- **Test mode:** unit
- **Traceability:** `packages/db/src/adapters/d1-catalog.ts` (visibility filter on latest) , `apps/registry/src/controllers/catalog.ts` (handleCatalog) - `apps/registry/src/controllers/handlers.test.ts`

The catalog lists each package's latest visible version only. A package whose
latest is yanked or taken down does not appear, so the storefront never surfaces a
package a client cannot install.

**REG-009-AC1** , a package whose only version is yanked is absent
```gherkin
Given "@brika/plugin-weather" has a single version that is yanked
When a client sends GET /-/v1/packages
Then "@brika/plugin-weather" does not appear in "packages"
```

**REG-009-AC2** , a package whose only version is taken down is absent
```gherkin
Given "@brika/plugin-weather" has a single version that is taken down
When a client sends GET /-/v1/packages
Then "@brika/plugin-weather" does not appear in "packages"
```

---

## REG-010 , Per-package download stats

- **Status:** [DONE]
- **Area:** Stats
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/stats.ts` (handleDownloads), `packages/registry-core/src/downloads.ts` (summarizeDownloads), `packages/db/src/adapters/d1-downloads.ts` (per-day buckets) - `packages/registry-core/src/downloads.test.ts`, `packages/db/src/adapters/d1-downloads.test.ts`

`GET /-/v1/downloads/:name` returns install counts for one package: an all-time
total, a trailing 7-day weekly count, and a trailing 30-day per-day series
(oldest first, zero-filled) for the detail-page sparkline.

**REG-010-AC1** , 200 with total, weekly, and a 30-element series
```gherkin
Given "@brika/plugin-weather" has recorded downloads
When a client sends GET /-/v1/downloads/@brika/plugin-weather
Then the response status is 200
And the body "name" equals "@brika/plugin-weather"
And the body has numeric "total" and "weekly"
And "series" is an array of 30 numbers ordered oldest day first
```

**REG-010-AC2** , weekly is the trailing 7-day sum
```gherkin
Given per-day download counts exist for the package over the last 30 days
When a client reads "weekly"
Then "weekly" equals the sum of the counts for the trailing 7 days
And "total" equals the sum of all recorded days
```

**REG-010-AC3** , a package with no downloads returns zeros
```gherkin
Given "@brika/plugin-weather" has no recorded downloads
When a client sends GET /-/v1/downloads/@brika/plugin-weather
Then the response status is 200
And "total" equals 0 and "weekly" equals 0
And "series" is an array of 30 zeros
```

---

## REG-011 , Tarball origin pinned to REGISTRY_URL

- **Status:** [DONE]
- **Area:** Resolve / origin pinning
- **Test mode:** unit
- **Traceability:** `apps/registry/src/npm-url.ts` (tarballUrl), `packages/registry-core/src/packument.ts` (dist.tarball assembly), `packages/registry-core/src/resolve.ts` (baseUrl) - `apps/registry/src/controllers/packages.test.ts`

The `dist.tarball` URL is built from the configured `REGISTRY_URL` base, not the
request `Host` header, so a client cannot poison the resolved download origin by
spoofing `Host`, and tarball URLs are stable across edge nodes.

**REG-011-AC1** , dist.tarball uses the configured registry base, not Host
```gherkin
Given the registry is configured with REGISTRY_URL "https://registry.brika.dev"
When a client sends GET /@brika/plugin-weather with Host "evil.example.com"
Then every versions[*].dist.tarball begins with "https://registry.brika.dev/"
And no dist.tarball references "evil.example.com"
```

---

## REG-012 , Open, CORS-frontable read surface

- **Status:** [DONE]
- **Area:** Resolve / access
- **Test mode:** unit
- **Traceability:** `apps/registry/src/controllers/packages.ts`, `apps/registry/src/controllers/catalog.ts`, `apps/registry/src/controllers/stats.ts` - `apps/registry/src/controllers/handlers.test.ts`

All read endpoints (packument, tarball, catalog, stats) are anonymous: no
authentication is required and no rate limit applies to reads, and responses carry
public cache headers so they are CDN- and edge-cacheable.

**REG-012-AC1** , reads require no authentication
```gherkin
Given a request carries no Authorization header
When a client sends GET for a packument, tarball, catalog, or stats endpoint
Then the response is served normally (200 or a content-based 404), never 401 or 403
```

**REG-012-AC2** , read responses are publicly cacheable
```gherkin
Given a successful packument, catalog, or stats response
When the client inspects the Cache-Control header
Then it is "public, max-age=60"
```

**REG-012-AC3** , reads are not rate limited
```gherkin
Given many successive read requests from one client
When the client repeatedly sends GET for a packument, tarball, catalog, or stats endpoint
Then no request is rejected with 429
```
