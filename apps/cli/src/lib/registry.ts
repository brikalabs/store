import { CliError } from "@brika/cli-kit";
import { z } from "zod";

/**
 * Client for the registry's auth + publish endpoints. Installing is plain npm
 * protocol and needs no client; this only covers `/-/device/*` (RFC 8628 device
 * flow), `/-/publish`, and `/-/token/revoke`.
 *
 * Every request is time-boxed (and accepts an external `AbortSignal` for caller
 * cancellation), wraps transport failures in a `CliError`, and validates the
 * response body with zod. `fetch` is injectable so the client is unit-testable
 * without a live registry.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
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

export type TokenPoll =
  | { readonly status: "pending" }
  | { readonly status: "slow_down" }
  | { readonly status: "ok"; readonly token: string; readonly githubLogin: string }
  | { readonly status: "error"; readonly error: string };

export interface PublishRequest {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  readonly tarballBase64: string;
}

export type PublishResult =
  | { readonly ok: true; readonly integrity: string }
  | { readonly ok: false; readonly status: number; readonly error: string; readonly code?: string };

/** The subset of `fetch` the client uses, so a stub can be injected in tests. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface RegistryClientOptions {
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
  /** External cancellation, composed with the per-request timeout. */
  readonly signal?: AbortSignal;
}

export class RegistryClient {
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  readonly #signal?: AbortSignal;

  constructor(baseUrl: string, options: RegistryClientOptions = {}) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#signal = options.signal;
  }

  async requestDeviceCode(): Promise<DeviceCode> {
    const res = await this.#send("/-/device/code", { method: "POST" });
    if (!res.ok) throw new CliError(`could not start device login (${res.status})`);
    return this.#parse(res, DeviceCodeSchema);
  }

  async pollDeviceToken(deviceCode: string): Promise<TokenPoll> {
    const res = await this.#postJson("/-/device/token", { device_code: deviceCode });
    const body = await this.#parse(res, DeviceTokenSchema);
    if (res.ok && body.access_token !== undefined) {
      return { status: "ok", token: body.access_token, githubLogin: body.github_login ?? "unknown" };
    }
    if (body.error === "authorization_pending") return { status: "pending" };
    if (body.error === "slow_down") return { status: "slow_down" };
    return { status: "error", error: body.error ?? `device token failed (${res.status})` };
  }

  async publish(token: string, req: PublishRequest): Promise<PublishResult> {
    const res = await this.#postJson(
      "/-/publish",
      { name: req.name, version: req.version, manifest: req.manifest, tarball: req.tarballBase64 },
      token,
    );
    const body = await this.#parse(res, PublishResponseSchema);
    if (res.ok && body.integrity !== undefined) return { ok: true, integrity: body.integrity };
    return {
      ok: false,
      status: res.status,
      error: body.error ?? `publish failed (${res.status})`,
      code: body.code,
    };
  }

  /** Best-effort revoke; never throws (logout must clear locally regardless). */
  async revokeToken(token: string): Promise<void> {
    await this.#send("/-/token/revoke", { method: "POST", headers: bearer(token) }).catch(() => {});
  }

  /** POST a JSON body, optionally bearer-authed. */
  #postJson(path: string, body: unknown, token?: string): Promise<Response> {
    return this.#send(path, {
      method: "POST",
      headers: token === undefined ? JSON_HEADERS : { ...JSON_HEADERS, ...bearer(token) },
      body: JSON.stringify(body),
    });
  }

  /** Fetch with a timeout (+ optional external signal), mapping failures to CliError. */
  async #send(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.#baseUrl}${path}`;
    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const signal = this.#signal ? AbortSignal.any([this.#signal, timeout]) : timeout;
    try {
      return await this.#fetch(url, { ...init, signal });
    } catch (cause) {
      if (timeout.aborted) {
        throw new CliError(`request to ${url} timed out after ${this.#timeoutMs}ms`);
      }
      if (this.#signal?.aborted) throw new CliError(`request to ${url} was cancelled`);
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
