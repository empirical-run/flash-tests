import { test, expect } from "../lib/fixtures";
import { expectHomeLoaded } from "../pages/home";
import { openCommandBar } from "../pages/command-bar";

test.describe("Command Bar", () => {
  test("Search and navigate to settings via command bar", async ({ page }) => {
    await page.goto("/");
    await expectHomeLoaded(page);

    const input = await openCommandBar(page);
    await input.fill("lorem settings", { timeout: 45_000 });
    await page
      .getByLabel("Projects")
      .getByText("Lorem Ipsum › Settings", { exact: true })
      .click();

    await expect(page).toHaveURL(/settings/);
    await expect(
      page.getByRole("dialog").filter({
        has: page.getByRole("heading", { name: "Settings", exact: true }),
      }),
    ).toBeVisible();
  });
});
