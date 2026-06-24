import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guards every locale against `en` (the key source of truth): same namespace files, same keys per
// namespace. Catches a translation that drifts or a key added to one locale but not another, across
// all namespaces including ones added later by the migration.

const LOCALES_DIR = join(import.meta.dir, "locales");
const REFERENCE = "en";

const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const others = locales.filter((locale) => locale !== REFERENCE);

function namespaceFiles(locale: string): string[] {
  return readdirSync(join(LOCALES_DIR, locale))
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function keysOf(locale: string, file: string): string[] {
  const parsed: unknown = JSON.parse(readFileSync(join(LOCALES_DIR, locale, file), "utf8"));
  if (parsed === null || typeof parsed !== "object") return [];
  return Object.keys(parsed).sort();
}

describe("locale catalogs are in parity with en", () => {
  test("the reference locale exists with namespaces", () => {
    expect(locales).toContain(REFERENCE);
    expect(namespaceFiles(REFERENCE).length).toBeGreaterThan(0);
  });

  test("every locale ships the same namespace files", () => {
    for (const locale of others) {
      expect(namespaceFiles(locale)).toEqual(namespaceFiles(REFERENCE));
    }
  });

  test("every locale has the same keys per namespace", () => {
    for (const file of namespaceFiles(REFERENCE)) {
      const reference = keysOf(REFERENCE, file);
      for (const locale of others) {
        expect(keysOf(locale, file)).toEqual(reference);
      }
    }
  });
});
