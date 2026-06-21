import type { DeviceGrant, DeviceStore } from "@brika/registry-core";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { regDeviceAuth } from "../schema";

/** D1-backed {@link DeviceStore}: pending RFC 8628 grants in `reg_device_auth`. */
export class D1DeviceStore implements DeviceStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async create(grant: { deviceCode: string; userCode: string; expiresAt: number }): Promise<void> {
    await this.#db.insert(regDeviceAuth).values(grant);
  }

  async find(deviceCode: string): Promise<DeviceGrant | null> {
    const rows = await this.#db
      .select()
      .from(regDeviceAuth)
      .where(eq(regDeviceAuth.deviceCode, deviceCode))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return null;
    return {
      deviceCode: row.deviceCode,
      userCode: row.userCode,
      userId: row.userId,
      approved: row.approved,
      expiresAt: row.expiresAt,
    };
  }

  async remove(deviceCode: string): Promise<void> {
    await this.#db.delete(regDeviceAuth).where(eq(regDeviceAuth.deviceCode, deviceCode));
  }
}
