import { trimTrailingSlash } from "@brika/registry-core";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side BetterAuth client (AUTH-011 / USER-004), targeting `/api/auth/*`.
 *
 * `createAuthClient` validates `baseURL` as an ABSOLUTE url at construction (which also runs during
 * SSR), so a relative `/api/auth` throws. Real requests only fire in the browser, so use
 * `VITE_BETTER_AUTH_URL`, else `window.location.origin`, else an SSR placeholder never actually called.
 */
const RAW_ORIGIN = import.meta.env?.VITE_BETTER_AUTH_URL as string | undefined;
const ORIGIN = RAW_ORIGIN === undefined ? undefined : trimTrailingSlash(RAW_ORIGIN);

function authBaseUrl(): string {
  if (ORIGIN !== undefined) return `${ORIGIN}/api/auth`;
  if (globalThis.window !== undefined) return `${globalThis.location.origin}/api/auth`;
  return "http://localhost/api/auth";
}

export const authClient = createAuthClient({ baseURL: authBaseUrl() });

export const { listAccounts, linkSocial, unlinkAccount } = authClient;
