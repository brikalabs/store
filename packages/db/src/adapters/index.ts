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
export { D1OrgDomains } from "./d1-org-domains";
export { D1OrgMembers } from "./d1-org-members";
export { D1OrgScopes } from "./d1-org-scopes";
export { D1OrgStore } from "./d1-org-store";
export { D1OwnershipPolicy } from "./d1-ownership";
export { CloudflareDohResolver } from "./doh-resolver";
export { HmacDomainChallenge } from "./hmac-domain-challenge";
export {
  listOrgsForMember,
  listScopesForMember,
  listSubjectTokens,
  type MemberOrg,
  type MemberScope,
  revokeTokenByHash,
  type SubjectToken,
} from "./queries";
export { D1TokenStore, issueToken, revokeToken, verifyToken } from "./token";
