import { expect, test } from "@playwright/test";

test("migration reaches done only after the execute goal is proven", async ({ page }) => {
  await page.goto("/preview");

  await page.getByRole("button", { name: "Execute plan" }).click();
  await expect(page.getByText("Evidence pending")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Goal achieved" })).toBeVisible();
  await expect(page.getByText("Answer is returned")).toBeVisible();
});
