import { createHmac } from "node:crypto";

/**
 * Mint a signed session cookie for the e2e operator, matching the store's stateless cookie
 * format (`brika_session=<userId>.<base64url HMAC-SHA256(secret, userId)>`; see
 * src/lib/auth/session.ts). The secret + the operator user/login are pinned in
 * playwright.config.ts and the seed, so this lets the spec authenticate as an operator
 * without driving the real GitHub OAuth flow.
 */

/** Must match the `users.id` seeded in seed.ts and the secret in playwright.config.ts. */
const OPERATOR_USER_ID = "u-operator";
const SESSION_SECRET = "dev-only-secret-not-for-production";

function signSession(userId: string): string {
  const signature = createHmac("sha256", SESSION_SECRET).update(userId).digest("base64url");
  return `${userId}.${signature}`;
}

/** A Playwright cookie that authenticates the browser context as the operator. */
export function operatorCookie() {
  return {
    name: "brika_session",
    value: signSession(OPERATOR_USER_ID),
    domain: "localhost",
    path: "/",
  };
}
