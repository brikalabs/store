import { describe, expect, test } from "bun:test";
import { orgDescriptionSchema, orgDomainSchema, orgLinkSchema, orgLinksSchema } from "./profile";

describe("orgLinkSchema", () => {
  test("accepts a labelled http(s) link", () => {
    expect(orgLinkSchema.parse({ label: "X", url: "https://x.com/acme" })).toEqual({
      label: "X",
      url: "https://x.com/acme",
    });
    expect(orgLinkSchema.safeParse({ label: "Docs", url: "http://docs.acme.io" }).success).toBe(
      true,
    );
  });

  test("rejects non-http(s) URLs and unsafe labels", () => {
    expect(orgLinkSchema.safeParse({ label: "x", url: "javascript:alert(1)" }).success).toBe(false);
    expect(orgLinkSchema.safeParse({ label: "x", url: "data:text/html,hi" }).success).toBe(false);
    expect(orgLinkSchema.safeParse({ label: "x", url: "not a url" }).success).toBe(false);
  });
});

describe("orgLinksSchema", () => {
  test("accepts any number up to the cap, rejects over it", () => {
    const one = [{ label: "X", url: "https://x.com" }];
    expect(orgLinksSchema.safeParse(one).success).toBe(true);
    const many = Array.from({ length: 21 }, (_, i) => ({ label: `l${i}`, url: "https://x.com" }));
    expect(orgLinksSchema.safeParse(many).success).toBe(false);
  });
});

describe("orgDescriptionSchema", () => {
  test("accepts free text up to 500 chars, rejects control chars and overlong text", () => {
    expect(orgDescriptionSchema.safeParse("We build plugins.").success).toBe(true);
    expect(orgDescriptionSchema.safeParse("a".repeat(501)).success).toBe(false);
    expect(orgDescriptionSchema.safeParse("bad​zero-width").success).toBe(false);
  });
});

describe("orgDomainSchema", () => {
  test("accepts bare hostnames (lowercased), rejects URLs and bare TLDs", () => {
    expect(orgDomainSchema.parse("Brika.Dev")).toBe("brika.dev");
    expect(orgDomainSchema.safeParse("docs.brika.dev").success).toBe(true);
    expect(orgDomainSchema.safeParse("https://brika.dev").success).toBe(false);
    expect(orgDomainSchema.safeParse("brika").success).toBe(false);
    expect(orgDomainSchema.safeParse("brika.dev/path").success).toBe(false);
  });
});
