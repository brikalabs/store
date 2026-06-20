export { createClient, type Db, getDb } from "./client";
export * as schema from "./schema";
export {
  regAudit,
  regDeviceAuth,
  regDistTags,
  regDownloads,
  regPackages,
  regScopeDomains,
  regScopeMembers,
  regScopes,
  regTokens,
  regTrustedPublishers,
  regVersions,
} from "./schema";
