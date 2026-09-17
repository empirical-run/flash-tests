import { test, expect } from "./fixtures";
import { expectAppLoaded } from "./pages/home";
import { openProfileMenu } from "./pages/profile-menu";

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

  await dashboardLink.click();
  await expectAppLoaded(page);
});
