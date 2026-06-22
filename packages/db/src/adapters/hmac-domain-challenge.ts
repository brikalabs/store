import { token as diToken, inject } from "@brika/di";
import type { DomainChallenge } from "@brika/registry-core";

/** HMAC secret for scope-domain verification challenges (ORG-010). Each app provides it; injected
 *  by {@link HmacDomainChallenge}. `@brika/registry-runtime` re-exports it for the composition roots. */
export const DomainSecret = diToken<string>("DomainSecret");

/** base64url (no padding) of raw bytes, for a compact DNS-TXT-safe token. */
function base64url(bytes: ArrayBuffer): string {
  const b64 = btoa(String.fromCodePoint(...new Uint8Array(bytes)));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/**
 * Stateless {@link DomainChallenge}: the verification token is
 * `base64url(HMAC-SHA256(secret, "<scope>:<domain>"))`, derived on demand from one
 * server secret. Nothing per-domain is stored, so there is no challenge to leak from the
 * database, and the registry + console agree on the value as long as they share the secret.
 * Shared by both Workers (constructed in each composition root with `DOMAIN_VERIFY_SECRET`).
 */
export class HmacDomainChallenge implements DomainChallenge {
  readonly #secret = inject(DomainSecret);
  #keyPromise: Promise<CryptoKey> | null = null;

  // Import the HMAC key lazily (and once): construction stays cheap and cannot throw, and
  // the key is only materialized when a challenge is actually computed.
  #key(): Promise<CryptoKey> {
    this.#keyPromise ??= crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.#secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return this.#keyPromise;
  }

  async token(scope: string, domain: string): Promise<string> {
    const data = new TextEncoder().encode(`${scope}:${domain}`);
    return base64url(await crypto.subtle.sign("HMAC", await this.#key(), data));
  }
}
