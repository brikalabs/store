import { getDb, regDeviceAuth } from "@brika/store-db";
import { and, eq, gt } from "drizzle-orm";

/**
 * Approve a pending device-authorization (RFC 8628) for `githubLogin`, binding the
 * login so `brika auth login` can mint a publish token. This is the store's one
 * write into the registry's shared `reg_device_auth` table; it goes through the
 * registry's typed schema (`@brika/store-db`) rather than raw SQL, so it stays
 * type-safe and portable off D1.
 *
 * Returns false when the code is invalid, expired, or already approved: a single
 * conditional UPDATE whose match is read back via RETURNING, so it is a race-free
 * no-op on a stale code.
 */
export async function approveDeviceCode(
  d1: D1Database,
  userCode: string,
  githubLogin: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const approved = await getDb(d1)
    .update(regDeviceAuth)
    .set({ approved: true, githubLogin })
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
