import { inject } from "@brika/di";
import { listSubjectTokens, revokeTokenByHash, type SubjectToken } from "@brika/store-db/adapters";
import { RegistryDb } from "@/server/registry-services";

/**
 * The web account UI's reads + revocation over the registry's `reg_tokens` table, always scoped to
 * one account `userId` so a user only ever sees or revokes their OWN publish tokens. A route asks
 * `inject(PublishTokenStore).listSubjectTokens(...)` rather than threading the drizzle client.
 */
export class PublishTokenStore {
  readonly #db = inject(RegistryDb);

  /** The caller's publish tokens (hash + timestamps), newest first. */
  listSubjectTokens(userId: string): Promise<SubjectToken[]> {
    return listSubjectTokens(this.#db, userId);
  }

  /** Revoke one of the caller's tokens by hash; resolves false when no such owned token exists. */
  revokeTokenByHash(userId: string, tokenHash: string): Promise<boolean> {
    return revokeTokenByHash(this.#db, userId, tokenHash);
  }
}
