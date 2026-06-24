import { CliError } from "@brika/cli-kit";
import { type TransparencyEntry, trimTrailingSlash } from "@brika/registry-core";
import { npmLink } from "@brika/router/npm";
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
  /** Verification URL with the code pre-filled (RFC 8628), when the server provides one. */
  verification_uri_complete: z.string().optional(),
  interval: z.number(),
  expires_in: z.number(),
});

const DeviceTokenSchema = z.object({
  access_token: z.string().optional(),
  user_id: z.string().optional(),
  // Human display name resolved by the registry (null when the account has none).
  display_name: z.string().nullish(),
  error: z.string().optional(),
});

const WhoamiSchema = z.object({
  user_id: z.string(),
  display_name: z.string().nullish(),
});

const PublishResponseSchema = z.object({
  integrity: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

const ManageResponseSchema = z.object({
  ok: z.boolean().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

const ScopeResponseSchema = z.object({
  ok: z.boolean().optional(),
  scope: z.string().optional(),
  created: z.boolean().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

const ScopeRole = z.enum(["admin", "member"]);
export type ScopeRole = z.infer<typeof ScopeRole>;

const MembersResponseSchema = z.object({
  ok: z.boolean().optional(),
  members: z.array(z.object({ userId: z.string(), role: ScopeRole })).optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

export interface ScopeMember {
  readonly userId: string;
  readonly role: ScopeRole;
}

export interface ScopeClaim {
  readonly scope: string;
  /** True when this call created the scope; false when the caller already owned it. */
  readonly created: boolean;
}

export type DeviceCode = z.infer<typeof DeviceCodeSchema>;

export interface DeviceLogin {
  readonly token: string;
  readonly userId: string;
  /** Resolved human display name, or null when the account has none (fall back to the id). */
  readonly displayName: string | null;
}

export interface WhoamiResult {
  readonly userId: string;
  /** Resolved human display name, or null when the account has none. */
  readonly displayName: string | null;
}

export interface PublishRequest {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  /** The gzipped tarball, base64-encoded. */
  readonly tarball: string;
  /** Transparency-log entry for the signed tarball (sigstore), when attested. */
  readonly transparencyLog?: TransparencyEntry;
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
    this.#baseUrl = trimTrailingSlash(baseUrl);
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
        return {
          token: body.access_token,
          userId: body.user_id ?? "unknown",
          displayName: body.display_name ?? null,
        };
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

  /**
   * Resolve the signed-in account for the presented token (`GET /-/whoami`): the
   * account id plus its display name (null when the account has none). Throws a
   * `CliError` when the token is missing or rejected.
   */
  async whoami(token: string): Promise<WhoamiResult> {
    const res = await this.#send("/-/whoami", { method: "GET", headers: bearer(token) });
    if (!res.ok) throw new CliError(`could not resolve the signed-in account (${res.status})`);
    const body = await this.#parse(res, WhoamiSchema);
    return { userId: body.user_id, displayName: body.display_name ?? null };
  }

  /** Publish a version, returning its integrity. Throws a `CliError` on rejection. */
  async publish(token: string, req: PublishRequest): Promise<Published> {
    const res = await this.#postJson("/-/publish", req, token);
    const body = await this.#parse(res, PublishResponseSchema);
    if (res.ok && body.integrity !== undefined) return { integrity: body.integrity };
    throw new CliError(
      `publish rejected (${res.status}${codeSuffix(body.code)}): ${body.error ?? "unknown error"}`,
    );
  }

  /**
   * Create/claim a scope for the authenticated identity (`PUT /-/scope/:scope`).
   * Idempotent: a scope the caller already owns succeeds with `created: false`. Throws
   * a `CliError` when the scope is owned by someone else or the name is invalid.
   */
  async createScope(token: string, scope: string): Promise<ScopeClaim> {
    const res = await this.#send(`/-/scope/${encodeURIComponent(scope)}`, {
      method: "PUT",
      headers: bearer(token),
    });
    const body = await this.#parse(res, ScopeResponseSchema);
    if (res.ok && body.ok === true) return { scope, created: body.created ?? false };
    throw new CliError(
      `could not create scope ${scope} (${res.status}${codeSuffix(body.code)}): ${
        body.error ?? "unknown error"
      }`,
    );
  }

  /** List a scope's members (`GET /-/scope/:scope/members`). */
  async listScopeMembers(token: string, scope: string): Promise<ScopeMember[]> {
    const res = await this.#send(`/-/scope/${encodeURIComponent(scope)}/members`, {
      method: "GET",
      headers: bearer(token),
    });
    const body = await this.#parse(res, MembersResponseSchema);
    if (res.ok && body.members !== undefined) return body.members;
    throw new CliError(this.#scopeError("list members of", scope, res.status, body));
  }

  /** Add a member or change their role (`PUT /-/scope/:scope/member/:userId`). */
  async setScopeMember(
    token: string,
    scope: string,
    userId: string,
    role: ScopeRole,
  ): Promise<void> {
    const res = await this.#send(this.#memberPath(scope, userId), {
      method: "PUT",
      headers: { ...JSON_HEADERS, ...bearer(token) },
      body: JSON.stringify({ role }),
    });
    const body = await this.#parse(res, ManageResponseSchema);
    if (res.ok && body.ok === true) return;
    throw new CliError(this.#scopeError("update a member of", scope, res.status, body));
  }

  /** Remove a member (`DELETE /-/scope/:scope/member/:userId`). */
  async removeScopeMember(token: string, scope: string, userId: string): Promise<void> {
    const res = await this.#send(this.#memberPath(scope, userId), {
      method: "DELETE",
      headers: bearer(token),
    });
    const body = await this.#parse(res, ManageResponseSchema);
    if (res.ok && body.ok === true) return;
    throw new CliError(this.#scopeError("remove a member of", scope, res.status, body));
  }

  #memberPath(scope: string, userId: string): string {
    return `/-/scope/${encodeURIComponent(scope)}/member/${encodeURIComponent(userId)}`;
  }

  #scopeError(
    verb: string,
    scope: string,
    status: number,
    body: { error?: string; code?: string },
  ): string {
    return `could not ${verb} ${scope} (${status}${codeSuffix(body.code)}): ${
      body.error ?? "unknown error"
    }`;
  }

  /** Deprecate (or, with `message: null`, un-deprecate) a published version. */
  async deprecate(
    token: string,
    name: string,
    version: string,
    message: string | null,
  ): Promise<void> {
    await this.#manage(token, name, version, "deprecate", { message });
  }

  /** Yank (`yanked: true`) or restore (`false`) a published version. */
  async yank(token: string, name: string, version: string, yanked: boolean): Promise<void> {
    await this.#manage(token, name, version, "yank", { yanked });
  }

  /** Shared POST to a management endpoint; throws a `CliError` on rejection. */
  async #manage(
    token: string,
    name: string,
    version: string,
    action: "deprecate" | "yank",
    body: unknown,
  ): Promise<void> {
    const path = npmLink(`/-/package/:name/:version/${action}`, { name, version });
    const res = await this.#postJson(path, body, token);
    const parsed = await this.#parse(res, ManageResponseSchema);
    if (res.ok && parsed.ok === true) return;
    throw new CliError(
      `${action} rejected (${res.status}${codeSuffix(parsed.code)}): ${
        parsed.error ?? "unknown error"
      }`,
    );
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

/** ` <code>` for an error code, or "" when the response carried none. */
function codeSuffix(code: string | undefined): string {
  return code === undefined ? "" : ` ${code}`;
}
