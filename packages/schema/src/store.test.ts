import { expect, test } from "bun:test";
import { RegistryPublishSchema, StoreLocaleSchema } from "./store";

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

test("accepts optional screenshots", () => {
  const result = RegistryPublishSchema.safeParse({
    ...publishable,
    screenshots: ["./assets/1.png", "./assets/2.png"],
  });
  expect(result.success).toBe(true);
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
    tagline: "Live forecasts on your board",
    description: "A longer markdown description.",
    keywords: ["weather", "forecast"],
  });
  expect(ok.success).toBe(true);
  expect(StoreLocaleSchema.safeParse({ description: "no title" }).success).toBe(false);
});
