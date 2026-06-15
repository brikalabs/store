import { CliError } from "@brika/cli-kit";
import { z } from "zod";

/**
 * Client for the registry's auth + publish endpoints. Installing is plain npm
 * protocol and needs no client; this only covers `/-/device/*` (RFC 8628 device
 * flow), `/-/publish`, and `/-/token/revoke`. Every request has a timeout, wraps
 * network failures in a `CliError`, and validates the response shape with zod.
 * `fetch` is injectable so the client is unit-testable without a live registry.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

const DeviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  interval: z.number(),
  expires_in: z.number(),
});
export type DeviceCode = z.infer<typeof DeviceCodeSchema>;

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
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly code?: string;
    };

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

  async requestDeviceCode(): Promise<DeviceCode> {
    const res = await this.#request("/-/device/code", { method: "POST" });
    if (!res.ok) throw new CliError(`could not start device login (${res.status})`);
    return this.#read(res, DeviceCodeSchema);
  }

  async pollDeviceToken(deviceCode: string): Promise<TokenPoll> {
    const res = await this.#request("/-/device/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
    });
    const body = await this.#read(res, DeviceTokenSchema);
    if (res.ok && body.access_token !== undefined) {
      return {
        status: "ok",
        token: body.access_token,
        githubLogin: body.github_login ?? "unknown",
      };
    }
    if (body.error === "authorization_pending") return { status: "pending" };
    if (body.error === "slow_down") return { status: "slow_down" };
    return { status: "error", error: body.error ?? `device token failed (${res.status})` };
  }

  async publish(token: string, req: PublishRequest): Promise<PublishResult> {
    const res = await this.#request("/-/publish", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: req.name,
        version: req.version,
        manifest: req.manifest,
        tarball: req.tarballBase64,
      }),
    });
    const body = await this.#read(res, PublishResponseSchema);
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
    try {
      await this.#request("/-/token/revoke", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // ignored: logout proceeds even if the registry is unreachable
    }
  }

  async #request(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.#baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      return await this.#fetch(url, { ...init, signal: controller.signal });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new CliError(`request to ${url} timed out after ${this.#timeoutMs}ms`);
      }
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new CliError(`could not reach ${url}: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async #read<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
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
