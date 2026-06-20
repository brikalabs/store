import { describe, expect, test } from "bun:test";
import {
  scopeDescriptionSchema,
  scopeDomainSchema,
  scopeLinkSchema,
  scopeLinksSchema,
} from "./profile";

describe("scopeLinkSchema", () => {
  test("accepts a labelled http(s) link", () => {
    expect(scopeLinkSchema.parse({ label: "X", url: "https://x.com/acme" })).toEqual({
      label: "X",
      url: "https://x.com/acme",
    });
    expect(scopeLinkSchema.safeParse({ label: "Docs", url: "http://docs.acme.io" }).success).toBe(
      true,
    );
  });

  test("rejects non-http(s) URLs and unsafe labels", () => {
    expect(scopeLinkSchema.safeParse({ label: "x", url: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(scopeLinkSchema.safeParse({ label: "x", url: "data:text/html,hi" }).success).toBe(false);
    expect(scopeLinkSchema.safeParse({ label: "x", url: "not a url" }).success).toBe(false);
  });
});

describe("scopeLinksSchema", () => {
  test("accepts any number up to the cap, rejects over it", () => {
    const one = [{ label: "X", url: "https://x.com" }];
    expect(scopeLinksSchema.safeParse(one).success).toBe(true);
    const many = Array.from({ length: 21 }, (_, i) => ({ label: `l${i}`, url: "https://x.com" }));
    expect(scopeLinksSchema.safeParse(many).success).toBe(false);
  });
});

describe("scopeDescriptionSchema", () => {
  test("accepts free text up to 500 chars, rejects control chars and overlong text", () => {
    expect(scopeDescriptionSchema.safeParse("We build plugins.").success).toBe(true);
    expect(scopeDescriptionSchema.safeParse("a".repeat(501)).success).toBe(false);
    expect(scopeDescriptionSchema.safeParse("bad​zero-width").success).toBe(false);
  });
});

describe("scopeDomainSchema", () => {
  test("accepts bare hostnames (lowercased), rejects URLs and bare TLDs", () => {
    expect(scopeDomainSchema.parse("Brika.Dev")).toBe("brika.dev");
    expect(scopeDomainSchema.safeParse("docs.brika.dev").success).toBe(true);
    expect(scopeDomainSchema.safeParse("https://brika.dev").success).toBe(false);
    expect(scopeDomainSchema.safeParse("brika").success).toBe(false);
    expect(scopeDomainSchema.safeParse("brika.dev/path").success).toBe(false);
  });
});
