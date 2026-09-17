import { test, expect } from "./fixtures";
import { expectAppLoaded } from "./pages/home";
import { openProfileMenu } from "./pages/profile-menu";
import { isPreviewEnvironment } from "./pages/urls";

test.describe("Profile menu marketing navigation", () => {
  // As with the production-only public docs test, this marketing CTA targets
  // empirical.run/login and cannot reuse authentication from a preview origin.
  test.skip(
    () => isPreviewEnvironment(),
    "The marketing site's Dashboard CTA is a production-only navigation surface",
  );

  test("can visit the marketing home page and return to the dashboard", async ({
    page,
  }) => {
    await page.goto("/lorem-ipsum/test-runs");
    await expectAppLoaded(page);

    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: "Home Page", exact: true }).click();

    await expect(page).toHaveURL(/\/home$/);
    const dashboardLink = page.getByRole("link", {
      name: "Dashboard",
      exact: true,
    });
    await expect(dashboardLink).toBeVisible();

    const dashboardPagePromise = page.context().waitForEvent("page");
    await dashboardLink.click();
    const dashboardPage = await dashboardPagePromise;
    await expectAppLoaded(dashboardPage);
    await dashboardPage.close();
  });
});
