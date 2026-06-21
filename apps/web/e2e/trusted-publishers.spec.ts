import { expect, test } from "@playwright/test";
import { findLocalD1 } from "../scripts/seed-lib";
import { sessionCookie } from "./session";

/**
 * The trusted-publisher console (PUB-016), end to end. A scope admin authorizes a GitHub repo
 * + workflow to publish to their scope via tokenless OIDC, then revokes it. Signs in as the
 * seeded `@brika` scope admin (`e2e-bot`) via a minted session cookie; the binding is the
 * `@brika` scope seeded by seed.ts.
 */
test("a scope admin adds and removes a trusted publisher for a scope", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([await sessionCookie(findLocalD1(), "u-e2e-bot")]);
  const page = await context.newPage();

  await page.goto("/dashboard/scopes/@brika");
  const card = page.locator("section", { hasText: "Trusted publishers" });
  await expect(card.getByText("@brika").first()).toBeVisible();

  await card.getByLabel("Repository").fill("brikalabs/plugin-x");
  await card.getByLabel("Workflow filename").fill("publish.yml");
  await card.getByRole("button", { name: "Add" }).click();

  await expect(card.getByText("brikalabs/plugin-x")).toBeVisible();
  await expect(card.getByText("publish.yml")).toBeVisible();

  await card.getByRole("button", { name: /Remove .*brikalabs\/plugin-x/ }).click();
  await expect(card.getByText("brikalabs/plugin-x")).toHaveCount(0);

  await context.close();
});
