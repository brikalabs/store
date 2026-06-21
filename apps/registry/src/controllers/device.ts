import { inject } from "@brika/di";
import { DeviceService } from "@brika/registry-core";
import { badRequest, rateLimit, reply, unauthorized } from "@brika/router";
import { z } from "zod";
import { cf, clientKey } from "../adapters/cf-rate-limiter";
import { requireWrite } from "../auth";
import { vars } from "../env";
import { controller, route } from "../http/router";
import { ResolveDisplayName, Tokens } from "../services";

/**
 * OAuth device authorization flow (RFC 8628) for `brika auth login`, plus token
 * revocation for `brika logout`. The CLI gets a code, the user approves it on
 * store.brika.dev (which has GitHub login), and the CLI polls until a publish
 * token is issued. The state machine lives in `DeviceService`
 * (`@brika/registry-core`); these handlers are the thin HTTP layer plus token
 * issuance (an app-side adapter concern). The token endpoint keeps its own body
 * parse so it can return RFC 8628's `invalid_request` error code.
 */

export async function handleDeviceCode(): Promise<Response> {
  const code = await inject(DeviceService).requestCode();
  const verificationUri = `${vars().STORE_URL.replace(/\/+$/, "")}/device`;
  return reply(
    {
      device_code: code.deviceCode,
      user_code: code.userCode,
      verification_uri: verificationUri,
      // Code pre-filled so the CLI can open the page ready to authorize (RFC 8628).
      verification_uri_complete: `${verificationUri}?code=${code.userCode}`,
      interval: code.intervalSeconds,
      expires_in: code.expiresInSeconds,
    },
    200,
  );
}

const TokenRequest = z.object({ device_code: z.string() });

export async function handleDeviceToken(req: Request): Promise<Response> {
  const parsed = TokenRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw badRequest("invalid_request");

  const result = await inject(DeviceService).redeem(parsed.data.device_code);
  if (!result.ok) throw badRequest(result.error);

  const token = await inject(Tokens).issue(result.githubLogin);
  // Resolve a human display name for the CLI's "Logged in as ..." line. Null when the
  // login has no store account/profile yet; the CLI then shows the github login.
  const displayName = await inject(ResolveDisplayName)(result.githubLogin);
  return reply(
    {
      access_token: token,
      token_type: "bearer",
      github_login: result.githubLogin,
      display_name: displayName,
    },
    200,
  );
}

/**
 * `GET /-/whoami` - token-authed identity for `brika whoami`. Returns the
 * authenticated github login plus its resolved display name (null when none),
 * so the CLI can render the signed-in account without re-running the device flow.
 */
export async function handleWhoami(req: Request): Promise<Response> {
  const identity = await requireWrite(req, inject(Tokens));
  const githubLogin = identity.owner;
  const displayName = await inject(ResolveDisplayName)(githubLogin);
  return reply({ github_login: githubLogin, display_name: displayName }, 200);
}

/** Revoke the presented publish token (used by `brika logout`). Idempotent. */
export async function handleRevoke(req: Request): Promise<Response> {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw unauthorized();
  await inject(Tokens).revoke(authorization.slice("Bearer ".length));
  return reply({ ok: true }, 200);
}

export const deviceController = controller({
  name: "device",
  routes: [
    // Grant creation is the abuse-prone step; rate-limit it by client IP. Token
    // polling below is intentionally not limited: the CLI polls it every few seconds.
    route.post({
      path: "/-/device/code",
      middleware: [
        rateLimit({ max: 10, window: "1m", key: clientKey, store: cf("DEVICE_LIMITER") }),
      ],
      handler: () => handleDeviceCode(),
    }),
    route.post({ path: "/-/device/token", handler: ({ req }) => handleDeviceToken(req) }),
    route.get({ path: "/-/whoami", handler: ({ req }) => handleWhoami(req) }),
    route.post({ path: "/-/token/revoke", handler: ({ req }) => handleRevoke(req) }),
  ],
});
