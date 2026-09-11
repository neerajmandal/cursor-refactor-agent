import { expect, test } from "@playwright/test";

test("migration reaches done only after parity passes", async ({ page }) => {
  await page.goto("/preview");

  await page.getByRole("button", { name: "Execute proof" }).click();
  await expect(page.getByText("Evidence pending")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parity proven" })).toBeVisible();
  await expect(page.getByText("Required journey passed")).toBeVisible();
  await expect(page.getByText("Answer is returned")).toBeVisible();
});
