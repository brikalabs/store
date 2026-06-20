import { sessionCookie } from "./session";

/** Must match the operator `users.id` seeded in seed.ts (and REGISTRY_ADMINS in .dev.vars). */
const OPERATOR_USER_ID = "u-operator";

/** A Playwright cookie that authenticates the browser context as the e2e operator. */
export function operatorCookie() {
  return sessionCookie(OPERATOR_USER_ID);
}
