# @brika/schema

Canonical Zod schemas for Brika plugin manifests and the store/registry metadata
layered on top of them. This is the single source of truth for "what a valid
plugin looks like": the CLI validates against it before publishing, the registry
re-validates on the publish path, and JSON Schemas for IDE support can be
generated from it.

## Exports

- `@brika/schema/plugin`, the plugin `package.json` manifest:
  `PluginPackageSchema` (and its inferred type) plus the preference schema.
- `@brika/schema/store`, the store/registry layer: `RegistryPublishSchema` (a
  valid plugin manifest plus the store fields `icon`, `displayName`,
  `description`), `StoreLocaleSchema`, `storeLocaleOf`, and
  `validateStoreLocales` for i18n metadata.
- `@brika/schema` (root) re-exports both.

## Usage

```ts
import { RegistryPublishSchema } from "@brika/schema/store";

const result = RegistryPublishSchema.safeParse(manifest);
if (!result.success) throw new Error(result.error.message);
```

## Why split plugin from store

The plugin manifest is what a hub needs to *run* a plugin; the store schema adds
only what the storefront needs to *display* it. Keeping them in separate entry
points means a consumer that only loads plugins does not pull in store-only
metadata rules.

## Tests

```sh
bun test
```
