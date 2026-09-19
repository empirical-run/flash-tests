import { test, expect } from "../fixtures";
import { loginWithPassword } from "../pages/login";
import { getDashboardBaseUrl } from "../pages/urls";
import {
  createSession,
  getChatMessageByText,
  navigateToSessions,
} from "../pages/sessions";

test.describe("Link Preview Tests", () => {
  test("should show real session content and its descriptive title", async ({
    browser,
    page: crawlerPage,
    trackCurrentSession,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "link-preview",
      "This scenario requires the link-preview project's crawler user agent",
    );

    const prompt = `Link preview title fixture ${Date.now()}: reply OK`;

    // Keep the configured page unauthenticated with its crawler user agent. Use a
    // separate normal browser context only to create a real per-environment fixture.
    const creatorContext = await browser.newContext({
      baseURL: getDashboardBaseUrl(),
    });
    const creatorPage = await creatorContext.newPage();
    await creatorPage.goto("/login");
    await loginWithPassword(creatorPage);
    await expect(
      creatorPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await creatorPage.goto("/lorem-ipsum/test-runs");
    await expect(
      creatorPage.getByText("Lorem Ipsum", { exact: true }).first(),
    ).toBeVisible();
    await navigateToSessions(creatorPage);
    await createSession(creatorPage, prompt);
    trackCurrentSession(creatorPage);

    // Prove the generated URL resolves to real session content and receives the
    // current descriptive title instead of a legacy ID-only fallback title.
    await expect(
      creatorPage.getByText("Page not found", { exact: true }),
    ).toHaveCount(0);
    await expect(getChatMessageByText(creatorPage, prompt)).toBeVisible({
      timeout: 30000,
    });
    await expect(creatorPage).toHaveTitle(
      /^.+ \([^)]+\) · empirical-run\/lorem-ipsum-tests · Empirical$/,
    );

    const sessionUrl = "/sessions/999999999";
    await crawlerPage.goto(sessionUrl);

    // The bot remains unauthenticated and sees the session access state. This
    // positive assertion distinguishes a real private session from the 404 route
    // that made the old hardcoded test pass vacuously.
    await expect(
      crawlerPage.getByRole("heading", { name: "Unauthorized" }),
    ).toBeVisible();
    await expect(
      crawlerPage.getByText("Page not found", { exact: true }),
    ).toHaveCount(0);

    // SessionTracker cleanup runs with the configured fixture page. Copy auth only
    // after the crawler assertions; cookies do not reload or change the rendered
    // unauthenticated access state, but let afterEach close the generated session.
    await crawlerPage.context().addCookies(await creatorContext.cookies());
    await creatorContext.close();
  });
});
