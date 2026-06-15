/**
 * Thin client for the Brika registry's auth + publish endpoints. The install
 * side is plain npm protocol and needs no client; this only covers the custom
 * `/-/device/*` (RFC 8628 device flow) and `/-/publish` surfaces.
 */

export interface DeviceCode {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly interval: number;
  readonly expires_in: number;
}

export async function requestDeviceCode(registry: string): Promise<DeviceCode> {
  const res = await fetch(`${registry}/-/device/code`, { method: "POST" });
  if (!res.ok) throw new Error(`could not start device login (${res.status})`);
  return (await res.json()) as DeviceCode;
}

export type TokenPoll =
  | { readonly status: "pending" }
  | { readonly status: "slow_down" }
  | { readonly status: "ok"; readonly token: string; readonly githubLogin: string }
  | { readonly status: "error"; readonly error: string };

export async function pollDeviceToken(registry: string, deviceCode: string): Promise<TokenPoll> {
  const res = await fetch(`${registry}/-/device/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_code: deviceCode }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    github_login?: string;
    error?: string;
  };
  if (res.ok && body.access_token !== undefined) {
    return { status: "ok", token: body.access_token, githubLogin: body.github_login ?? "unknown" };
  }
  if (body.error === "authorization_pending") return { status: "pending" };
  if (body.error === "slow_down") return { status: "slow_down" };
  return { status: "error", error: body.error ?? `device token failed (${res.status})` };
}

/** Revoke a publish token server-side. Best-effort; the CLI clears locally regardless. */
export async function revokeToken(registry: string, token: string): Promise<void> {
  await fetch(`${registry}/-/token/revoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

export interface PublishRequest {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  readonly tarballBase64: string;
}

export type PublishOutcome =
  | { readonly ok: true; readonly integrity: string }
  | { readonly ok: false; readonly status: number; readonly error: string; readonly code?: string };

export async function publishVersion(
  registry: string,
  token: string,
  req: PublishRequest,
): Promise<PublishOutcome> {
  const res = await fetch(`${registry}/-/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: req.name,
      version: req.version,
      manifest: req.manifest,
      tarball: req.tarballBase64,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    integrity?: string;
    error?: string;
    code?: string;
  };
  if (res.ok && body.integrity !== undefined) return { ok: true, integrity: body.integrity };
  return {
    ok: false,
    status: res.status,
    error: body.error ?? `publish failed (${res.status})`,
    code: body.code,
  };
}
