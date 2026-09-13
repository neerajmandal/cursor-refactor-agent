import { expect, test } from "@playwright/test";

test("research, plan, and implementation remain gated by their documents", async ({
  page,
}) => {
  await page.goto("/preview");

  await expect(
    page.getByRole("button", { name: /Create implementation plan/ }),
  ).toBeVisible();
  await expect(page.getByText("research-plan.md", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Plan/ })).toBeDisabled();

  await page.getByRole("button", { name: /Create implementation plan/ }).click();
  await expect(page.getByText("implementation-plan.md", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Approve and implement/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Approve and implement/ }).click();
  await expect(page.getByRole("button", { name: /Review implementation/ })).toBeVisible();
  await expect(page.getByText("verification-report.md", { exact: true })).toBeVisible();
  await expect(
    page.getByText("FO48 is an overcurrent trip. Stop the line and inspect the motor circuit."),
  ).toBeVisible();
  await expect(page.locator("video")).toBeVisible();
});
