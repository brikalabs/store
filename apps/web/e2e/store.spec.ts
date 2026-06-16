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

test("the icon plugin is published, listed, and renders its detail", async ({ page }) => {
  // Search surfaces the registry plugin first.
  await page.goto("/plugins?q=icon");
  await expect(page.getByText("Icon Studio").first()).toBeVisible();
  // Detail renders with the install command and the tarball-extracted readme.
  await page.goto("/plugins/@brika/plugin-icon");
  await expect(page.getByRole("heading", { name: "Icon Studio" }).first()).toBeVisible();
  await expect(page.getByText("@brika/plugin-icon").first()).toBeVisible();
  await expect(page.getByText(/200k\+ glyphs/i).first()).toBeVisible();
});

test("the icon plugin's generated icon is served from its tarball", async ({ request }) => {
  const res = await request.get(
    "/v1/plugins/%40brika%2Fplugin-icon/asset?v=0.1.0&path=assets%2Ficon.svg",
  );
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
  // The icon was produced by the icon-studio template (gradient + glyph).
  expect(await res.text()).toContain("icon-studio-bg");
});

test("plugin management: deprecated version is badged, yanked version is hidden", async ({
  page,
}) => {
  // The seed published @brika/plugin-managed at 1.0.0/1.1.0/1.2.0, then deprecated
  // 1.1.0 and yanked 1.0.0 through the real CLI. The Versions tab should reflect it.
  await page.goto("/plugins/@brika/plugin-managed?tab=versions");
  // Scope to the versions panel so the header's latest-version label doesn't match.
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "Changelog" })).toBeVisible();
  // Newest-first: 1.2.0 is Latest, 1.1.0 carries the Deprecated badge, and 1.0.0
  // was yanked so it never appears.
  await expect(panel.getByText("v1.2.0")).toBeVisible();
  await expect(panel.getByText("v1.1.0")).toBeVisible();
  await expect(panel.getByText("Latest")).toBeVisible();
  await expect(panel.getByText("Deprecated")).toBeVisible();
  await expect(panel.getByText("v1.0.0")).toHaveCount(0);
});

test("the reviews tab shows the seeded grade and reviews", async ({ page }) => {
  // The seed wrote three D1-backed reviews for plugin-i18n; the tab aggregates a
  // grade and lists them. (Sign-in is required to write one.)
  await page.goto("/plugins/@brika/plugin-i18n?tab=reviews");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText(/reviews/i).first()).toBeVisible();
  await expect(panel.getByText("Saved us weeks")).toBeVisible();
  await expect(panel.getByText("Mara Lopez").first()).toBeVisible();
  await expect(panel.getByText(/Sign in with GitHub to write a review/i)).toBeVisible();
});

test("the discussion tab shows the seeded threaded comments", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n?tab=discussion");
  const panel = page.getByRole("tabpanel");
  // The root question and its threaded reply both render.
  await expect(panel.getByText(/right-to-left locales like Arabic/i)).toBeVisible();
  await expect(panel.getByText(/RTL is detected from the BCP-47 tag/i)).toBeVisible();
  await expect(panel.getByText(/Sign in with GitHub to join the discussion/i)).toBeVisible();
});

test("detail shows a real install count", async ({ page, request }) => {
  // Generate at least one install (tarball download) so the count is non-zero.
  await request.get("/v1/plugins/@brika%2Fplugin-i18n/asset?v=0.1.0&path=assets%2Ficon.svg");
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByText(/\d+ installs/).first()).toBeVisible();
});

test("detail shows the tarball integrity hash", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByText("Integrity", { exact: true })).toBeVisible();
  // The sha512 prefix of the SRI is rendered.
  await expect(page.getByText(/sha512-/).first()).toBeVisible();
});

test("detail shows the downloads trend card (Clay chart)", async ({ page, request }) => {
  // Ensure at least one install so the trend card renders.
  await request.get("/v1/plugins/@brika%2Fplugin-i18n/asset?v=0.1.0&path=assets%2Ficon.svg");
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByText("Total downloads")).toBeVisible();
  // The Clay chart kit renders a recharts surface inside the card.
  await expect(page.locator(".recharts-responsive-container").first()).toBeVisible();
});

test("detail shows the integrity & provenance section (seeded CI publish)", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByRole("heading", { name: /Integrity & provenance/i })).toBeVisible();
  await expect(page.getByText("GitHub Actions")).toBeVisible();
  await expect(page.getByText("Source Commit")).toBeVisible();
  // The packed digest row summarises the tarball.
  await expect(page.getByText(/tarball ·/)).toBeVisible();
  // The integrity copy button is present and interactive.
  await expect(page.getByRole("button", { name: /Copy/i }).first()).toBeVisible();
  // The public-ledger row links to the sigstore transparency-log entry.
  const ledger = page.getByRole("link", { name: /Transparency log entry/i });
  await expect(ledger).toBeVisible();
  await expect(ledger).toHaveAttribute("href", /search\.sigstore\.dev/);
});

test("overview groups permissions by family with visible scope", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByRole("heading", { name: "Permissions requested" })).toBeVisible();
  // Net family: host allow-list, including the wildcard host.
  await expect(page.getByText("Network", { exact: true })).toBeVisible();
  await expect(page.getByText("translation.googleapis.com")).toBeVisible();
  await expect(page.getByText("*.deepl.com")).toBeVisible();
  // netLocal family surfaces the loopback port (the Ollama case).
  await expect(page.getByText("localhost:11434")).toBeVisible();
  // Secrets is the sensitive family; the reverse-DNS grant id is shown.
  await expect(page.getByText("Secrets", { exact: true })).toBeVisible();
  await expect(page.getByText("Sensitive")).toBeVisible();
  await expect(page.getByText("dev.brika.secrets.get")).toBeVisible();
  // The trust note explains per-family consent + audit-log redaction.
  await expect(page.getByText(/recorded in the audit log/i)).toBeVisible();
});

test("snapshot permissions show filesystem read/write path patterns", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-snapshot");
  await expect(page.getByText("Filesystem", { exact: true })).toBeVisible();
  await expect(page.getByText("/data/cache/**")).toBeVisible();
  await expect(page.getByText("dev.brika.fs.write")).toBeVisible();
});

test("overview lists real dependencies from the manifest", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n");
  await expect(page.getByRole("heading", { name: /Dependencies/i })).toBeVisible();
  await expect(page.getByText("@formatjs/intl")).toBeVisible();
  await expect(page.getByText("2 dev dependencies")).toBeVisible();
  // The resolved-version column shows the lockfile pin, and the footer reassures.
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await expect(page.getByText("2.10.5")).toBeVisible();
  await expect(page.getByText(/No known vulnerabilities/i)).toBeVisible();
});

test("detail tabs are routed: clicking updates the URL and panel", async ({ page }) => {
  await page.goto("/plugins/@brika/plugin-i18n");
  // Overview is the default: dependencies visible.
  await expect(page.getByRole("heading", { name: /Dependencies/i })).toBeVisible();

  // Versions tab -> changelog panel + ?tab=versions in the URL. Retry the click
  // until the SPA has hydrated (the SSR tab has no handler until then).
  await expect(async () => {
    await page.getByRole("tab", { name: "Versions" }).click();
    await expect(page.getByRole("heading", { name: "Changelog" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page).toHaveURL(/tab=versions/);
  await expect(page.getByRole("heading", { name: /Dependencies/i })).toHaveCount(0);

  // Deep-linking the tab via the URL renders that panel directly (SSR).
  await page.goto("/plugins/@brika/plugin-i18n?tab=reviews");
  await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();

  // The sticky sidebar (download count) stays visible across tabs.
  await expect(page.getByText("Total downloads")).toBeVisible();
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
