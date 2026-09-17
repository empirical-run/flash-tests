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
    const routes = [
      { path: "/", expectedFinalPath: /^\/$/ },
      { path: "/login", expectedFinalPath: /^\/login$/ },
      {
        path: "/lorem-ipsum/test-runs",
        // An unauthenticated request redirects to login; an authenticated request
        // serves the protected route directly.
        expectedFinalPath:
          /^(\/lorem-ipsum\/test-runs|\/login\?returnTo=%2Florem-ipsum%2Ftest-runs)$/,
      },
    ];

    for (const { path, expectedFinalPath } of routes) {
      // This literal is intentional: the legacy host must be tested independently
      // of BUILD_URL and getDashboardBaseUrl().
      const response = await request.get(`https://dash.empirical.run${path}`);
      const finalUrl = new URL(response.url());

      expect(
        response.ok(),
        `${path} should resolve successfully (final URL: ${response.url()}, status: ${response.status()})`,
      ).toBe(true);
      expect(["dash.empirical.run", "empirical.run"]).toContain(
        finalUrl.hostname,
      );
      expect(`${finalUrl.pathname}${finalUrl.search}`).toMatch(
        expectedFinalPath,
      );
    }
  });
});
