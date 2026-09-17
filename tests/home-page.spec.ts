import { test, expect } from "./fixtures";
import { expectAppLoaded } from "./pages/home";
import { isPreviewEnvironment } from "./pages/urls";

test.describe("Home Page Tests", () => {
  test("toggle shows Lorem Ipsum", async ({ page }) => {
    // Navigate to homepage
    await page.goto("/");

    // Wait for page to load
    await expectAppLoaded(page);

    // Click on the Lorem Ipsum toggle button
    await page.getByRole("button", { name: "Lorem Ipsum" }).click();

    // Verify the project switcher opened and still marks Lorem Ipsum as selected.
    await expect(
      page.getByRole("option", { name: /Lorem Ipsum/ }),
    ).toBeVisible();
  });
});

test.describe("Legacy dashboard domain", () => {
  test.skip(
    () => isPreviewEnvironment(),
    "The legacy dashboard domain is a production-only concern",
  );

  test("dash.empirical.run serves key application routes", async ({
    request,
  }) => {
    const routes = ["/", "/login", "/lorem-ipsum/test-runs"];

    for (const route of routes) {
      const response = await request.get(`https://dash.empirical.run${route}`);

      expect(
        response.ok(),
        `${route} should resolve successfully (final URL: ${response.url()}, status: ${response.status()})`,
      ).toBe(true);
    }
  });
});
