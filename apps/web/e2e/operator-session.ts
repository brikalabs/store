import { findLocalD1 } from "../scripts/seed-lib";
import { sessionCookie } from "./session";

/** Must match the operator `users.id` seeded in seed.ts (and REGISTRY_ADMINS in .dev.vars). */
const OPERATOR_USER_ID = "u-operator";

/**
 * A Playwright cookie that authenticates the browser context as the e2e operator.
 * Mints a real BetterAuth session row in the local D1 (AUTH-012) and returns the
 * signed `better-auth.session_token` cookie, so the operator console gate resolves
 * the seeded operator user. Async because minting signs the cookie with WebCrypto.
 */
export function operatorCookie() {
  return sessionCookie(findLocalD1(), OPERATOR_USER_ID);
}
