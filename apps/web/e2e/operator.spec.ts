import { expect, test } from "@playwright/test";
import { operatorCookie } from "./operator-session";

/**
 * The operator console, end to end. The `/operator` section is gated on the
 * `REGISTRY_ADMINS` allowlist (set to `github:e2e-operator` in playwright.config.ts) and is
 * hidden from everyone else. These assert the gate (a non-operator cannot reach it) and the
 * ORG-007 takedown flow (withdraw a squatted scope from public listings, then restore it).
 *
 * The takedown target is the throwaway scope `@squatter` seeded by seed.ts, kept separate from
 * `@brika` so this never disturbs the storefront's public listings. Run serially so the
 * take-down / restore steps observe each other's state.
 *
 * Requires `.dev.vars` to set `REGISTRY_ADMINS=github:e2e-operator` (and the pinned
 * `SESSION_SECRET`); see .dev.vars.example. The worker reads those, not the process env.
 */
test.describe
  .serial("operator console", () => {
    test("a signed-out visitor cannot reach the console (its existence is hidden)", async ({
      page,
    }) => {
      const res = await page.goto("/operator/scopes");
      // requireOperator throws notFound() -> the not-found boundary, never the scopes UI.
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Scopes" })).toHaveCount(0);
    });

    test("an operator takes down a squatted scope, then restores it (ORG-007)", async ({
      browser,
    }) => {
      const context = await browser.newContext();
      await context.addCookies([await operatorCookie()]);
      const page = await context.newPage();

      // The squatter scope is public before the takedown.
      expect((await page.goto("/@squatter"))?.status()).toBe(200);

      await page.goto("/operator/scopes");
      await expect(page.getByRole("heading", { name: "Scopes" })).toBeVisible();
      const row = page.locator("li", { hasText: "@squatter" }).first();
      await expect(row).toBeVisible();

      // Take down: two-step (button -> reason -> confirm), then the badge appears.
      await row.getByRole("button", { name: "Take down" }).click();
      await row.getByPlaceholder(/Reason/i).fill("e2e: name-squatting");
      await row.getByRole("button", { name: "Confirm" }).click();
      await expect(row.getByText("Taken down")).toBeVisible();

      // The public scope page is now withdrawn (404), and the audit log records the action.
      expect((await page.goto("/@squatter"))?.status()).toBe(404);
      await page.goto("/operator/audit");
      await expect(page.getByText("scope_takedown").first()).toBeVisible();
      await expect(page.getByText("@squatter").first()).toBeVisible();

      // Restore puts it back into public listings.
      await page.goto("/operator/scopes");
      const restoredRow = page.locator("li", { hasText: "@squatter" }).first();
      await restoredRow.getByRole("button", { name: "Restore" }).click();
      await expect(restoredRow.getByRole("button", { name: "Take down" })).toBeVisible();
      expect((await page.goto("/@squatter"))?.status()).toBe(200);

      await context.close();
    });

    test("the packages directory lists every package, including managed/hidden ones", async ({
      browser,
    }) => {
      const context = await browser.newContext();
      await context.addCookies([await operatorCookie()]);
      const page = await context.newPage();

      await page.goto("/operator/packages");
      await expect(page.getByRole("heading", { name: "Packages" })).toBeVisible();
      // @brika/plugin-managed has a yanked version (seeded), so it is surfaced here even though
      // the public catalog hides yanked versions.
      await expect(page.getByText("@brika/plugin-managed").first()).toBeVisible();

      await context.close();
    });
  });
