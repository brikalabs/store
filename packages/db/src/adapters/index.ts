/**
 * Cloudflare D1 implementations of the `@brika/registry-core` storage ports, over the
 * shared `reg_*` schema. They depend only on registry-core types, this package's tables,
 * drizzle, and (the metadata writer) `@brika/tx` - no Cloudflare bindings - so both the
 * registry worker and the store web app wire them against the same database.
 */
export { D1AuditLog } from "./d1-audit";
export { D1CatalogReader } from "./d1-catalog";
export { D1DeviceStore } from "./d1-device";
export { D1DownloadStore } from "./d1-downloads";
export { D1MetadataReader } from "./d1-metadata";
export { D1MetadataWriter } from "./d1-metadata-writer";
export { D1OwnershipPolicy } from "./d1-ownership";
export { D1ScopeDomains } from "./d1-scope-domains";
export { D1ScopeMembers } from "./d1-scope-members";
export { D1ScopeStore } from "./d1-scope-store";
export { D1TrustedPublishers } from "./d1-trusted-publishers";
export { CloudflareDohResolver } from "./doh-resolver";
export { HmacDomainChallenge } from "./hmac-domain-challenge";
export {
  listAllPackages,
  listPackageNamesForScopes,
  listScopesForMember,
  listSubjectTokens,
  type MemberScope,
  type OperatorPackage,
  resolveActor,
  revokeTokenByHash,
  type SubjectToken,
} from "./queries";
export { D1TokenStore, issueToken, revokeToken, verifyToken } from "./token";
