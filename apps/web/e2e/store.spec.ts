import { expect, test } from "@playwright/test";

/**
 * The storefront, end to end against the local registry. These assert the M4
 * integration a human would check: registry-published `@brika/*` plugins are
 * discoverable, their detail renders with tarball-served assets, and the i18n
 * plugin shows localized copy.
 */

test("browse surfaces a registry-published plugin", async ({ page }) => {
  await page.goto("/plugins?q=i18n");
  await expect(page.getByText("i18n Toolkit").first()).toBeVisible();
});

test("plugin detail renders from the registry with the install command", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByRole("heading", { name: "i18n Toolkit" }).first()).toBeVisible();
  // The install command targets the scoped package on our registry.
  await expect(page.getByText("@brika/plugin-i18n").first()).toBeVisible();
  // The English readme, extracted from the tarball, is rendered.
  await expect(page.getByText(/Translate, format, and localize/i).first()).toBeVisible();
});

test("the snapshot plugin lists its capabilities", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-snapshot");
  await expect(page.getByRole("heading", { name: "Snapshot & Compress" })).toBeVisible();
});

test("detail shows a real install count", async ({ page, request }) => {
  // Generate at least one install (tarball download) so the count is non-zero.
  await request.get("/v1/plugins/@brika%2Fplugin-i18n/asset?v=0.1.0&path=assets%2Ficon.svg");
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByText(/\d+ installs/).first()).toBeVisible();
});

test("localized copy renders for the French locale", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n?lang=fr");
  // The fr store.json title + readme replace the default English copy.
  await expect(page.getByText(/Boite a outils i18n/i).first()).toBeVisible();
});

test("the icon asset is served from the tarball", async ({ request }) => {
  const res = await request.get(
    "/v1/plugins/%40brika%2Fplugin-i18n/asset?v=0.1.0&path=assets%2Ficon.svg",
  );
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
  expect(await res.text()).toContain("<svg");
});

test("a path-traversal asset request is rejected", async ({ request }) => {
  const res = await request.get(
    "/v1/plugins/%40brika%2Fplugin-i18n/asset?v=0.1.0&path=../../etc/passwd",
  );
  expect(res.status()).toBe(400);
});
