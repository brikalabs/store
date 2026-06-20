---
id: STORE-011
title: "Media and asset serving from the tarball"
status: done
area: store
group: store
test_mode: e2e
traceability:
  code:
    - apps/web/src/routes/v1.plugins.$name.v.$version.files.$.ts
    - apps/web/src/routes/v1.plugins.$name.v.$version.[index].ts
    - apps/web/src/lib/registry-assets.ts
  tests:
    - apps/web/e2e/store.spec.ts
---

## Description

For registry (`@brika/*`) packages, assets (icon, screenshots, readme images,
localized store.json, and any tarball file) are extracted from the version's tarball
on first request, cached in R2 (`reg/<name>@<version>/<path>`), and served with the
right content type and a long immutable cache. A version-pinned file index is also
served. Asset paths are validated against directory traversal.

## Acceptance criteria

### STORE-011-AC1 , An icon asset is served from the tarball with the right content type
```gherkin
Given @brika/plugin-icon@0.1.0 contains assets/icon.svg
When a client requests GET /v1/plugins/%40brika%2Fplugin-icon/v/0.1.0/files/assets/icon.svg
Then the response status is 200
And the content-type is image/svg+xml
And the body is the SVG from the tarball
And the cache-control header is "public, max-age=31536000, immutable"
```

### STORE-011-AC2 , A text source file is served inline as text
```gherkin
Given @brika/plugin-i18n@0.1.0 contains src/index.ts
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n/v/0.1.0/files/src/index.ts
Then the response status is 200
And the content-type begins with "text/" (not application/octet-stream)
```

### STORE-011-AC3 , A path-traversal asset request is rejected
```gherkin
Given a client requests an asset path that escapes the package root
When a client requests GET /v1/plugins/%40brika%2Fplugin-i18n/v/0.1.0/files/%2e%2e/%2e%2e/etc/passwd
Then the response status is 400 or 404 (not 200)
```

### STORE-011-AC4 , The version file index lists files with sizes and integrity
```gherkin
Given @brika/plugin-i18n@0.1.0 is published
When a client requests the version file index for that package and version
Then the response status is 200
And the JSON body has "files", "fileCount", "totalSize", "shasum", and "integrity"
```

### STORE-011-AC5 , Asset endpoints are registry-only
```gherkin
Given a name that is not a @brika/ registry name
When a client requests its version asset or file index
Then the response status is 404
```
