import { expect, test } from "bun:test";
import {
  RegistryPublishSchema,
  StoreLocaleSchema,
  storeLocaleOf,
  validateStoreLocales,
} from "./store";

const publishable = {
  name: "@brika/plugin-x",
  version: "1.2.3",
  main: "./src/index.ts",
  engines: { brika: "^0.4.0" },
  icon: "./assets/icon.svg",
  displayName: "Plugin X",
  description: "Does a thing",
};

test("accepts a complete publishable manifest", () => {
  expect(RegistryPublishSchema.safeParse(publishable).success).toBe(true);
});

test("accepts optional screenshots as objects with caption/alt", () => {
  const result = RegistryPublishSchema.safeParse({
    ...publishable,
    screenshots: [
      { src: "./assets/1.png" },
      { src: "./assets/2.png", caption: "The board view", alt: "A board of bricks" },
    ],
  });
  expect(result.success).toBe(true);
});

test("rejects screenshots given as bare strings", () => {
  const result = RegistryPublishSchema.safeParse({
    ...publishable,
    screenshots: ["./assets/1.png"],
  });
  expect(result.success).toBe(false);
});

test("rejects a screenshot src that escapes the package root", () => {
  const result = RegistryPublishSchema.safeParse({
    ...publishable,
    screenshots: [{ src: "../../etc/passwd" }],
  });
  expect(result.success).toBe(false);
});

test("requires an icon", () => {
  const { icon, ...withoutIcon } = publishable;
  void icon;
  expect(RegistryPublishSchema.safeParse(withoutIcon).success).toBe(false);
});

test("requires a displayName", () => {
  const { displayName, ...withoutTitle } = publishable;
  void displayName;
  expect(RegistryPublishSchema.safeParse(withoutTitle).success).toBe(false);
});

test("requires a description", () => {
  const { description, ...withoutDescription } = publishable;
  void description;
  expect(RegistryPublishSchema.safeParse(withoutDescription).success).toBe(false);
});

test("rejects an icon path that escapes the package root", () => {
  expect(
    RegistryPublishSchema.safeParse({ ...publishable, icon: "../../etc/passwd" }).success,
  ).toBe(false);
  expect(RegistryPublishSchema.safeParse({ ...publishable, icon: "/abs/icon.svg" }).success).toBe(
    false,
  );
});

test("StoreLocaleSchema validates a locale file", () => {
  const ok = StoreLocaleSchema.safeParse({
    title: "Weather",
    description: "A longer markdown description.",
    screenshotCaptions: ["The forecast card", "Settings"],
  });
  expect(ok.success).toBe(true);
  expect(StoreLocaleSchema.safeParse({ description: "no title" }).success).toBe(false);
});

test("storeLocaleOf recognizes only `locales/<lang>/store.json`", () => {
  expect(storeLocaleOf("locales/en/store.json")).toBe("en");
  expect(storeLocaleOf("locales/pt-BR/store.json")).toBe("pt-BR");
  expect(storeLocaleOf("locales/en/preferences.json")).toBeNull();
  expect(storeLocaleOf("package.json")).toBeNull();
});

test("validateStoreLocales accepts valid files and ignores non-locale files", () => {
  const issues = validateStoreLocales([
    { path: "package.json", text: "{}" },
    { path: "locales/en/store.json", text: JSON.stringify({ title: "X", description: "Y" }) },
    {
      path: "locales/fr/store.json",
      text: JSON.stringify({ title: "X", description: "Y", screenshotCaptions: ["a"] }),
    },
  ]);
  expect(issues).toEqual([]);
});

test("validateStoreLocales reports a bad locale tag, invalid JSON, and schema misses", () => {
  const issues = validateStoreLocales([
    { path: "locales/english/store.json", text: "{}" },
    { path: "locales/de/store.json", text: "{ not json" },
    { path: "locales/es/store.json", text: JSON.stringify({ description: "no title" }) },
  ]);
  expect(issues.map((i) => i.path).sort()).toEqual([
    "locales/de/store.json",
    "locales/english/store.json",
    "locales/es/store.json",
  ]);
});

test("validateStoreLocales rejects more captions than screenshots", () => {
  const issues = validateStoreLocales(
    [
      {
        path: "locales/en/store.json",
        text: JSON.stringify({ title: "X", description: "Y", screenshotCaptions: ["a", "b", "c"] }),
      },
    ],
    { screenshotCount: 2 },
  );
  expect(issues).toHaveLength(1);
  expect(issues[0]?.message).toContain("screenshotCaptions");
});
