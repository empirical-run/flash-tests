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
    // The Chromium project's root testDir can also discover this file when it is
    // passed explicitly; only the link-preview project supplies the crawler UA.
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

    const sessionUrl = creatorPage.url();
    await crawlerPage.goto(sessionUrl);

    // The bot remains unauthenticated and exercises the access-state rendering
    // for the exact generated URL. Session existence is proven above because the
    // current auth-first crawler response does not distinguish missing IDs.
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
