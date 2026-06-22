/** Canonical Zod schemas for Brika plugins and the store/registry metadata on top of them. */

export {
  type PluginPackageSchema as PluginPackageSchemaType,
  PluginPackageSchema,
  type PreferenceSchema as PreferenceSchemaType,
} from "./plugin";
export {
  type LocaleIssue,
  type RegistryPublishManifest,
  RegistryPublishSchema,
  type StoreLocale,
  StoreLocaleSchema,
  type StoreScreenshot,
  storeLocaleOf,
  validateStoreLocales,
} from "./store";
