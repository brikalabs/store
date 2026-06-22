import { token as diToken, inject } from "@brika/di";
import type { DomainChallenge } from "@brika/registry-core";

/** HMAC secret for scope-domain verification challenges (ORG-010). */
export const DomainSecret = diToken<string>("DomainSecret");

function base64url(bytes: ArrayBuffer): string {
  const b64 = btoa(String.fromCodePoint(...new Uint8Array(bytes)));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/**
 * Stateless {@link DomainChallenge}: `base64url(HMAC-SHA256(secret, "<scope>:<domain>"))`.
 * Nothing per-domain is stored, so there is no challenge to leak.
 */
export class HmacDomainChallenge implements DomainChallenge {
  readonly #secret = inject(DomainSecret);
  #keyPromise: Promise<CryptoKey> | null = null;

  // Imported lazily and once: construction stays cheap and cannot throw.
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
