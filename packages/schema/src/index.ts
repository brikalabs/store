/**
 * @brika/schema
 *
 * Canonical Zod schemas for Brika plugins and the store/registry metadata that
 * sits on top of them. JSON schemas can be generated from these for IDE support.
 */

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
