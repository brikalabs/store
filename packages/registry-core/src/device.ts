/**
 * OAuth 2.0 Device Authorization Grant (RFC 8628) state machine for
 * `brika auth login`: the CLI requests a code, the user approves it in the store,
 * and the CLI polls until a token is issued. Persistence is a `DeviceStore` port
 * (the registry app backs it with D1); randomness and the clock are injected so
 * the flow is deterministic under test. Token issuance stays in the app layer:
 * `redeem` returns the approved account id and the handler mints the token.
 */

/** A stored device-authorization grant. */
export interface DeviceGrant {
  readonly deviceCode: string;
  readonly userCode: string;
  /** Brika account id set when the user approves the device in the store, else null. */
  readonly userId: string | null;
  readonly approved: boolean;
  /** Expiry as a unix timestamp (seconds). */
  readonly expiresAt: number;
}

/** Persistence for pending device grants. */
export interface DeviceStore {
  create(grant: { deviceCode: string; userCode: string; expiresAt: number }): Promise<void>;
  find(deviceCode: string): Promise<DeviceGrant | null>;
  remove(deviceCode: string): Promise<void>;
}

/** A freshly issued device code, returned to the polling CLI. */
export interface IssuedDeviceCode {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly expiresInSeconds: number;
  readonly intervalSeconds: number;
}

/** RFC 8628 token-poll outcome: the approved account id, or a standard error code. */
export type DeviceRedeemResult =
  | { readonly ok: true; readonly userId: string }
  | {
      readonly ok: false;
      readonly error: "invalid_grant" | "expired_token" | "authorization_pending";
    };

export interface DeviceServiceOptions {
  readonly ttlSeconds?: number;
  readonly pollIntervalSeconds?: number;
  /** Current unix time in seconds; injected for deterministic tests. */
  readonly now?: () => number;
  /** Device-code generator (defaults to a random UUID). */
  readonly deviceCode?: () => string;
  /** User-code generator (defaults to two 4-char no-vowel groups). */
  readonly userCode?: () => string;
}

const DEFAULT_TTL_SECONDS = 15 * 60;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
// No vowels or ambiguous characters, so codes are easy to read aloud and type.
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ23456789";

function randomGroup(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export class DeviceService {
  readonly #store: DeviceStore;
  readonly #ttl: number;
  readonly #interval: number;
  readonly #now: () => number;
  readonly #deviceCode: () => string;
  readonly #userCode: () => string;

  constructor(store: DeviceStore, options: DeviceServiceOptions = {}) {
    this.#store = store;
    this.#ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    this.#interval = options.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1000));
    this.#deviceCode = options.deviceCode ?? (() => crypto.randomUUID());
    this.#userCode = options.userCode ?? (() => `${randomGroup(4)}-${randomGroup(4)}`);
  }

  /** Create a pending grant and return the codes for the CLI + approval page. */
  async requestCode(): Promise<IssuedDeviceCode> {
    const deviceCode = this.#deviceCode();
    const userCode = this.#userCode();
    await this.#store.create({ deviceCode, userCode, expiresAt: this.#now() + this.#ttl });
    return {
      deviceCode,
      userCode,
      expiresInSeconds: this.#ttl,
      intervalSeconds: this.#interval,
    };
  }

  /**
   * Resolve a polling CLI: returns the approved account id (consuming the
   * grant), or the RFC 8628 error otherwise. Expired grants are deleted.
   */
  async redeem(deviceCode: string): Promise<DeviceRedeemResult> {
    const grant = await this.#store.find(deviceCode);
    if (grant === null) return { ok: false, error: "invalid_grant" };
    if (grant.expiresAt <= this.#now()) {
      await this.#store.remove(deviceCode);
      return { ok: false, error: "expired_token" };
    }
    if (!grant.approved || grant.userId === null) {
      return { ok: false, error: "authorization_pending" };
    }
    await this.#store.remove(deviceCode);
    return { ok: true, userId: grant.userId };
  }
}
