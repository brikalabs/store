import { describe, expect, test } from "bun:test";
import { HmacDomainChallenge } from "./hmac-domain-challenge";

describe("HmacDomainChallenge", () => {
  test("is deterministic and matches across instances sharing the secret", async () => {
    const a = new HmacDomainChallenge("secret-1");
    const b = new HmacDomainChallenge("secret-1");
    const token = await a.token("acme", "brika.dev");
    expect(token).toBe(await a.token("acme", "brika.dev")); // stable
    expect(token).toBe(await b.token("acme", "brika.dev")); // agrees across workers
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, DNS-TXT-safe
  });

  test("binds the token to the org, the domain, and the secret", async () => {
    const c = new HmacDomainChallenge("secret-1");
    const base = await c.token("acme", "brika.dev");
    expect(await c.token("other", "brika.dev")).not.toBe(base); // org-bound
    expect(await c.token("acme", "other.dev")).not.toBe(base); // domain-bound
    expect(await new HmacDomainChallenge("secret-2").token("acme", "brika.dev")).not.toBe(base);
  });
});
