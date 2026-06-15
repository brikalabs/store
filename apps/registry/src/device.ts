import { env } from "cloudflare:workers";
import { getDb, regDeviceAuth } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { issueToken } from "./adapters/token";

/**
 * OAuth device authorization flow (RFC 8628) for `brika auth login`. The CLI
 * gets a code, the user approves it on store.brika.dev (which has GitHub login),
 * and the CLI polls until a publish token is issued.
 */

const VERIFICATION_URI = "https://store.brika.dev/device";
const DEVICE_TTL_SECONDS = 15 * 60;
const POLL_INTERVAL_SECONDS = 5;
// No vowels / ambiguous chars, so user codes are easy to read aloud and type.
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ23456789";

function reply(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export async function handleDeviceCode(): Promise<Response> {
  const deviceCode = crypto.randomUUID();
  const userCode = `${randomCode(4)}-${randomCode(4)}`;
  await getDb(env.DB)
    .insert(regDeviceAuth)
    .values({
      deviceCode,
      userCode,
      expiresAt: Math.floor(Date.now() / 1000) + DEVICE_TTL_SECONDS,
    });
  return reply(
    {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: VERIFICATION_URI,
      // Code pre-filled so the CLI can open the page ready to authorize (RFC 8628).
      verification_uri_complete: `${VERIFICATION_URI}?code=${userCode}`,
      interval: POLL_INTERVAL_SECONDS,
      expires_in: DEVICE_TTL_SECONDS,
    },
    200,
  );
}

const TokenRequest = z.object({ device_code: z.string() });

export async function handleDeviceToken(request: Request): Promise<Response> {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = TokenRequest.safeParse(raw);
  if (!parsed.success) return reply({ error: "invalid_request" }, 400);

  const db = getDb(env.DB);
  const rows = await db
    .select()
    .from(regDeviceAuth)
    .where(eq(regDeviceAuth.deviceCode, parsed.data.device_code))
    .limit(1);
  const record = rows[0];
  if (record === undefined) return reply({ error: "invalid_grant" }, 400);

  if (record.expiresAt <= Math.floor(Date.now() / 1000)) {
    await db.delete(regDeviceAuth).where(eq(regDeviceAuth.deviceCode, record.deviceCode));
    return reply({ error: "expired_token" }, 400);
  }
  if (!record.approved || record.githubLogin === null) {
    return reply({ error: "authorization_pending" }, 400);
  }

  const token = await issueToken(db, record.githubLogin);
  await db.delete(regDeviceAuth).where(eq(regDeviceAuth.deviceCode, record.deviceCode));
  return reply(
    { access_token: token, token_type: "bearer", github_login: record.githubLogin },
    200,
  );
}
