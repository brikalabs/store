import { inject } from "@brika/di";
import { listSubjectTokens, revokeTokenByHash, type SubjectToken } from "@brika/store-db/adapters";
import { RegistryDatabase } from "@/server/registry-services";

/**
 * The web account UI's reads + revocation over the registry's `reg_tokens` table, always scoped to
 * one `(provider, subject)` so a user only ever sees or revokes their OWN publish tokens. A route
 * asks `inject(PublishTokenStore).listSubjectTokens(...)` rather than threading the drizzle client.
 */
export class PublishTokenStore {
  readonly #db = inject(RegistryDatabase).orm;

  /** The caller's publish tokens (hash + timestamps), newest first. */
  listSubjectTokens(provider: string, subject: string): Promise<SubjectToken[]> {
    return listSubjectTokens(this.#db, provider, subject);
  }

  /** Revoke one of the caller's tokens by hash; resolves false when no such owned token exists. */
  revokeTokenByHash(provider: string, subject: string, tokenHash: string): Promise<boolean> {
    return revokeTokenByHash(this.#db, provider, subject, tokenHash);
  }
}
