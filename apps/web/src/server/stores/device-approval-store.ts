import { inject } from "@brika/di";
import { RegistryDb } from "@brika/registry-runtime";
import { regDeviceAuth } from "@brika/store-db";
import { and, eq, gt } from "drizzle-orm";

/**
 * The store's one write into the registry's shared `reg_device_auth` table: approve a pending
 * device-authorization (RFC 8628), binding the Brika account id so `brika auth login` can mint a token.
 */
export class DeviceApprovalStore {
  readonly #db = inject(RegistryDb);

  /**
   * Approve a pending device code for `userId`. A single conditional UPDATE read back via
   * RETURNING, so it is a race-free no-op (returns false) on an invalid, expired, or
   * already-approved code.
   */
  async approve(userCode: string, userId: string): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const approved = await this.#db
      .update(regDeviceAuth)
      .set({ approved: true, userId })
      .where(
        and(
          eq(regDeviceAuth.userCode, userCode),
          gt(regDeviceAuth.expiresAt, now),
          eq(regDeviceAuth.approved, false),
        ),
      )
      .returning({ deviceCode: regDeviceAuth.deviceCode });
    return approved.length > 0;
  }
}
