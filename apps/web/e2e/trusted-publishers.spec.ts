import { expect, test } from "@playwright/test";
import { sessionCookie } from "./session";

/**
 * The trusted-publisher console (PUB-016), end to end. An org admin authorizes a GitHub repo
 * + workflow to publish to one of the org's scopes via tokenless OIDC, then revokes it. Signs
 * in as the seeded `brika` org admin (`e2e-bot`) via a minted session cookie; the binding is
 * the `@brika` scope seeded by seed.ts.
 */
test("an org admin adds and removes a trusted publisher for a scope", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([sessionCookie("u-e2e-bot")]);
  const page = await context.newPage();

  await page.goto("/dashboard/orgs/brika");
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
