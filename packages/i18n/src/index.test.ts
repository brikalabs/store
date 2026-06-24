import { describe, expect, test } from "bun:test";
import { type Catalog, createTranslator, resolveLocale } from "./index";

const en: Catalog = {
  browse: { plugins: "{count, plural, one {# plugin} other {# plugins}}" },
  common: { hello: "Hi {name}" },
};
const fr: Catalog = {
  browse: { plugins: "{count, plural, one {# plugin} other {# plugins}}" },
};

describe("createTranslator", () => {
  test("selects the right ICU plural branch", () => {
    const t = createTranslator("en", en);
    expect(t("browse:plugins", { count: 1 })).toBe("1 plugin");
    expect(t("browse:plugins", { count: 5 })).toBe("5 plugins");
  });

  test("applies the locale's plural rules (French: 0 and 1 are singular)", () => {
    const t = createTranslator("fr", fr);
    expect(t("browse:plugins", { count: 0 })).toBe("0 plugin");
    expect(t("browse:plugins", { count: 1 })).toBe("1 plugin");
    expect(t("browse:plugins", { count: 2 })).toBe("2 plugins");
  });

  test("resolves the default namespace and interpolates", () => {
    const t = createTranslator("en", en);
    expect(t("hello", { name: "Max" })).toBe("Hi Max");
  });

  test("returns the key when the message is missing", () => {
    const t = createTranslator("en", en);
    expect(t("browse:missing")).toBe("browse:missing");
    expect(t("nope:also")).toBe("nope:also");
  });
});

describe("resolveLocale", () => {
  const supported = ["en", "fr"] as const;

  test("matches the primary subtag and respects order", () => {
    expect(resolveLocale("fr-FR,fr;q=0.9,en;q=0.8", supported, "en")).toBe("fr");
    expect(resolveLocale("en-US,en;q=0.9", supported, "en")).toBe("en");
  });

  test("falls back when absent or unsupported", () => {
    expect(resolveLocale(null, supported, "en")).toBe("en");
    expect(resolveLocale("de,es;q=0.5", supported, "en")).toBe("en");
  });
});
