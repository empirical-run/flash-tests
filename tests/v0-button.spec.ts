import { test, expect } from "./fixtures";

test.describe("v0 Button", () => {
  test("click button opens v0.app in a new tab", async ({ page, context }) => {
    await page.goto("https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/");

    // Expect the "Click me" button to be visible
    await expect(page.getByRole("button", { name: "Click me" })).toBeVisible();

    // Wait for new tab to open when clicking the button
    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "Click me" }).click(),
    ]);

    // Verify the new tab navigated to v0.app
    await expect(newPage).toHaveURL(/v0\.app/);
    await expect(newPage).toHaveTitle(/v0/);
  });
});
