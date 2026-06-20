import { createHmac } from "node:crypto";

/**
 * Mint a signed session cookie matching the store's stateless cookie format
 * (`brika_session=<userId>.<base64url HMAC-SHA256(secret, userId)>`; see
 * src/lib/auth/session.ts). The secret is pinned in playwright.config.ts / .dev.vars, so
 * a spec can authenticate as a seeded user without driving the real GitHub OAuth flow.
 */
const SESSION_SECRET = "dev-only-secret-not-for-production";

function sign(userId: string): string {
  return `${userId}.${createHmac("sha256", SESSION_SECRET).update(userId).digest("base64url")}`;
}

/** A Playwright cookie authenticating the browser context as `userId` (a `users.id`). */
export function sessionCookie(userId: string) {
  return { name: "brika_session", value: sign(userId), domain: "localhost", path: "/" };
}
