import { test, expect } from "./fixtures";
import { expectAppLoaded } from "./pages/home";
import { isPreviewEnvironment } from "./pages/urls";
import {
  openProjectSwitcherList,
  projectSwitcher,
} from "./pages/create-project";

test.describe("Home Page Tests", () => {
  test("toggle shows Lorem Ipsum", async ({ page }) => {
    // Navigate to homepage
    await page.goto("/");

    // Wait for page to load
    await expectAppLoaded(page);

    // The header toggle shows the active project.
    await expect(projectSwitcher(page)).toHaveAccessibleName(/Lorem Ipsum/);

    // Open the workspace menu's project list and verify Lorem Ipsum is listed
    // and marked as the active project with a check.
    const projectList = await openProjectSwitcherList(page);
    const loremIpsum = projectList.getByRole("option", { name: /Lorem Ipsum/ });
    await expect(loremIpsum).toBeVisible();
    await expect(loremIpsum.locator("svg.lucide-check")).toBeVisible();
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
      // Authenticated users are redirected from login back to the app root.
      { path: "/login", expectedFinalPath: /^(\/login|\/)$/ },
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
