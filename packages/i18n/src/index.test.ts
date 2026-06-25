import { describe, expect, test } from "bun:test";
import {
  buildCatalogs,
  type Catalog,
  CIMODE,
  createTranslator,
  defineI18n,
  formatDate,
  formatNumber,
  formatRelative,
  pickCatalog,
  resolveLocale,
} from "./index";

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

  test("caches the compiled format across calls", () => {
    const t = createTranslator("en", en);
    expect(t("browse:plugins", { count: 2 })).toBe("2 plugins");
    expect(t("browse:plugins", { count: 3 })).toBe("3 plugins"); // second call hits the cache
  });

  test("honors a custom default namespace", () => {
    const t = createTranslator("en", { errors: { boom: "Boom" } }, "errors");
    expect(t("boom")).toBe("Boom");
  });

  test("CIMODE echoes the key instead of resolving it", () => {
    const t = createTranslator(CIMODE, en);
    expect(t("browse:plugins", { count: 5 })).toBe("browse:plugins");
    expect(t("hello")).toBe("hello");
  });
});

describe("buildCatalogs / pickCatalog", () => {
  const modules = {
    "./locales/en/nav.json": { home: "Home" },
    "./locales/en/browse.json": { all: "All" },
    "./locales/fr/nav.json": { home: "Accueil" },
    "./not-a-locale-file.txt": { skip: "ignored" }, // no <locale>/<ns>.json match
  };

  test("assembles per-locale catalogs and ignores non-matching paths", () => {
    const catalogs = buildCatalogs(modules);
    expect(catalogs.en).toEqual({ nav: { home: "Home" }, browse: { all: "All" } });
    expect(catalogs.fr).toEqual({ nav: { home: "Accueil" } });
    expect(Object.keys(catalogs)).toEqual(["en", "fr"]);
  });

  test("picks the locale, falls back, then empty", () => {
    const catalogs = buildCatalogs(modules);
    expect(pickCatalog(catalogs, "fr", "en").nav?.home).toBe("Accueil");
    expect(pickCatalog(catalogs, "de", "en").nav?.home).toBe("Home"); // fallback
    expect(pickCatalog({}, "de", "en")).toEqual({}); // nothing
  });
});

describe("formatDate", () => {
  test("formats a valid date in the locale", () => {
    expect(
      formatDate("en-US", "2026-06-15", { year: "numeric", month: "long", day: "numeric" }),
    ).toBe("June 15, 2026");
    expect(formatDate("en-US", new Date("2026-06-15T00:00:00Z"), { timeZone: "UTC" })).toContain(
      "2026",
    );
  });

  test("returns empty for absent or invalid input", () => {
    expect(formatDate("en", undefined)).toBe("");
    expect(formatDate("en", "not-a-date")).toBe("");
  });
});

describe("formatRelative", () => {
  const now = Date.parse("2026-06-15T12:00:00Z");

  test("uses coarse units in the past", () => {
    expect(formatRelative("en", "2026-06-13T12:00:00Z", now)).toBe("2 days ago");
  });

  test("falls back to seconds near now", () => {
    expect(formatRelative("en", "2026-06-15T12:00:00Z", now)).toBe("now");
  });

  test("returns empty for absent or invalid input", () => {
    expect(formatRelative("en", undefined, now)).toBe("");
    expect(formatRelative("en", "nope", now)).toBe("");
  });
});

describe("defineI18n", () => {
  const messages = {
    "./locales/en/nav.json": { home: "Home" },
    "./locales/fr/nav.json": { home: "Accueil" },
    "./locales/de/nav.json": { home: "Start" },
    "./locales/ja/nav.json": { home: "ホーム" },
  };
  const i18n = defineI18n({
    messages,
    defaultLocale: "en",
    cookie: "brika-locale",
    order: ["en", "fr"],
    dev: true,
  });

  test("auto-detects locales (order then alphabetical) and appends cimode in dev", () => {
    expect(i18n.locales).toEqual(["en", "fr", "de", "ja", CIMODE]); // en,fr from order; de,ja alpha; cimode last (dev)
    expect(i18n.defaultLocale).toBe("en");
    expect(i18n.cookie).toBe("brika-locale");
  });

  test("catalogFor falls back to the default locale", () => {
    expect(i18n.catalogFor("fr").nav?.home).toBe("Accueil");
    expect(i18n.catalogFor("xx").nav?.home).toBe("Home");
  });

  test("localeFromCookie validates and allows cimode only in dev", () => {
    expect(i18n.localeFromCookie(null)).toBeNull();
    expect(i18n.localeFromCookie("other=1")).toBeNull(); // cookie not present
    expect(i18n.localeFromCookie("flag; brika-locale=fr")).toBe("fr"); // skips the value-less part
    expect(i18n.localeFromCookie("brika-locale=zz")).toBeNull(); // unsupported
    expect(i18n.localeFromCookie(`brika-locale=${CIMODE}`)).toBe(CIMODE); // dev: true
  });

  test("cimode is absent and rejected when dev is off", () => {
    const prod = defineI18n({ messages, defaultLocale: "en" });
    expect(prod.locales).not.toContain(CIMODE);
    expect(prod.localeFromCookie(`locale=${CIMODE}`)).toBeNull();
    expect(prod.cookie).toBe("locale"); // default cookie name
  });

  test("localeFromHeader picks the best supported locale", () => {
    expect(i18n.localeFromHeader("de-DE,de;q=0.9")).toBe("de");
    expect(i18n.localeFromHeader(null)).toBe("en");
  });

  test("localeForRequest prefers the cookie, else Accept-Language", () => {
    const cookied = new Request("https://x/", {
      headers: { cookie: "brika-locale=fr", "accept-language": "de" },
    });
    expect(i18n.localeForRequest(cookied)).toBe("fr");
    const headerOnly = new Request("https://x/", { headers: { "accept-language": "ja,en" } });
    expect(i18n.localeForRequest(headerOnly)).toBe("ja");
  });
});

describe("formatNumber", () => {
  test("formats in the locale", () => {
    expect(formatNumber("en-US", 1234.5)).toBe("1,234.5");
    expect(formatNumber("fr-FR", 1234.5)).toContain("234,5");
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

  test("skips empty tags", () => {
    expect(resolveLocale(",fr", supported, "en")).toBe("fr"); // leading empty part is skipped
  });
});
