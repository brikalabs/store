import { CliError } from "@brika/cli-kit";
import { z } from "zod";

/**
 * Client for the registry's auth + publish endpoints. Installing is plain npm
 * protocol and needs no client; this only covers `/-/device/*` (RFC 8628 device
 * flow), `/-/publish`, and `/-/token/revoke`.
 *
 * Failures are thrown as `CliError` and successes are returned directly, so
 * callers never branch on a result union. Every request is time-boxed, wraps
 * transport failures in a `CliError`, and validates the response body with zod.
 * `fetch` is injectable so the client is unit-testable without a live registry.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const SLOW_DOWN_BACKOFF_S = 5;
const JSON_HEADERS = { "content-type": "application/json" } as const;

const DeviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  interval: z.number(),
  expires_in: z.number(),
});

const DeviceTokenSchema = z.object({
  access_token: z.string().optional(),
  github_login: z.string().optional(),
  error: z.string().optional(),
});

const PublishResponseSchema = z.object({
  integrity: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export type DeviceCode = z.infer<typeof DeviceCodeSchema>;

export interface DeviceLogin {
  readonly token: string;
  readonly githubLogin: string;
}

export interface PublishRequest {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  /** The gzipped tarball, base64-encoded. */
  readonly tarball: string;
}

export interface Published {
  readonly integrity: string;
}

/** The subset of `fetch` the client uses, so a stub can be injected in tests. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface RegistryClientOptions {
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

export class RegistryClient {
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(baseUrl: string, options: RegistryClientOptions = {}) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Start the device flow, returning the code + URL to show the user. */
  async requestDeviceCode(): Promise<DeviceCode> {
    const res = await this.#send("/-/device/code", { method: "POST" });
    if (!res.ok) throw new CliError(`could not start device login (${res.status})`);
    return this.#parse(res, DeviceCodeSchema);
  }

  /**
   * Poll until the user approves the device code, returning the issued token.
   * Waits the server-provided interval between polls (backing off on
   * `slow_down`), and throws a `CliError` if the flow is denied or its deadline
   * passes.
   */
  async waitForToken(device: DeviceCode): Promise<DeviceLogin> {
    const deadline = Date.now() + device.expires_in * 1000;
    let interval = device.interval;
    while (Date.now() < deadline) {
      await Bun.sleep(interval * 1000);
      const res = await this.#postJson("/-/device/token", { device_code: device.device_code });
      const body = await this.#parse(res, DeviceTokenSchema);

      // RFC 8628 outcomes: a token (approved), `authorization_pending` (keep
      // waiting), `slow_down` (poll less often), or any other error (give up).
      if (res.ok && body.access_token !== undefined) {
        return { token: body.access_token, githubLogin: body.github_login ?? "unknown" };
      }
      if (body.error === "slow_down") {
        interval += SLOW_DOWN_BACKOFF_S;
        continue;
      }
      if (body.error === "authorization_pending") continue;
      const reason = body.error ?? `device token failed (${res.status})`;
      throw new CliError(`login failed: ${reason}`);
    }
    throw new CliError("login timed out - run `brika login` again");
  }

  /** Publish a version, returning its integrity. Throws a `CliError` on rejection. */
  async publish(token: string, req: PublishRequest): Promise<Published> {
    const res = await this.#postJson("/-/publish", req, token);
    const body = await this.#parse(res, PublishResponseSchema);
    if (res.ok && body.integrity !== undefined) return { integrity: body.integrity };
    const code = body.code === undefined ? "" : ` ${body.code}`;
    throw new CliError(`publish rejected (${res.status}${code}): ${body.error ?? "unknown error"}`);
  }

  /** Best-effort revoke; never throws (logout must clear locally regardless). */
  async revokeToken(token: string): Promise<void> {
    await this.#send("/-/token/revoke", { method: "POST", headers: bearer(token) }).catch(() => {});
  }

  /** POST a JSON body, optionally bearer-authed. */
  #postJson(path: string, body: unknown, token?: string): Promise<Response> {
    const headers = token === undefined ? JSON_HEADERS : { ...JSON_HEADERS, ...bearer(token) };
    return this.#send(path, { method: "POST", headers, body: JSON.stringify(body) });
  }

  /** Fetch with a timeout, mapping transport failures to CliError. */
  async #send(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.#baseUrl}${path}`;
    try {
      return await this.#fetch(url, { ...init, signal: AbortSignal.timeout(this.#timeoutMs) });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "TimeoutError") {
        throw new CliError(`request to ${url} timed out after ${this.#timeoutMs}ms`);
      }
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new CliError(`could not reach ${url}: ${reason}`);
    }
  }

  /** Read a JSON response and validate it against `schema`. */
  async #parse<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new CliError(`registry returned a non-JSON response (${res.status})`);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new CliError(`unexpected registry response (${res.status})`);
    return parsed.data;
  }
}

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
