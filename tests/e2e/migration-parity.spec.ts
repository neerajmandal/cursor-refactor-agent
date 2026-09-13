import { expect, test } from "@playwright/test";

test("preview keeps evidence available without execute controls", async ({ page }) => {
  await page.goto("/preview");

  await expect(page.getByRole("button", { name: /Execute (plan|again)/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Evidence" }).click();
  await expect(page.getByRole("heading", { name: "Goal achieved" })).toBeVisible();
  await expect(page.getByText("Answer is returned")).toBeVisible();
});
