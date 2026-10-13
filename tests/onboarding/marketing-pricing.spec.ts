import { test, expect } from "../fixtures";
import { isPreviewEnvironment } from "../pages/urls";

// The onboarding project has no saved authentication. Keep that explicit for
// this public marketing regression even if the project defaults change.
test.use({ storageState: { cookies: [], origins: [] } });

test.skip(
  () => isPreviewEnvironment(),
  "The public marketing website is a production-only surface",
);

test("logged-out visitor can open pricing from the marketing website", async ({
  page,
}) => {
  await page.goto("https://empirical.run/");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Pricing", exact: true })
    .click();

  // Report all three missing elements when public pricing regresses.
  await expect.soft(page).toHaveTitle(/Pricing/i);
  await expect
    .soft(
      page.getByRole("heading", { name: /Frequently asked questions|FAQ/i }),
    )
    .toBeVisible();
  await expect
    .soft(page.getByRole("main").getByText("Talk to us", { exact: true }))
    .toBeVisible();
});
