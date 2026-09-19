import { test, expect } from "../fixtures";
import { loginWithPassword } from "../pages/login";
import {
  createSession,
  getChatMessageByText,
  navigateToSessions,
} from "../pages/sessions";

test.describe("Link Preview Tests", () => {
  test("should show real session content and its descriptive title", async ({
    browser,
    page,
    trackCurrentSession,
  }) => {
    const prompt = `Link preview title fixture ${Date.now()}: reply OK`;

    // Create a session in this environment instead of relying on a shared session ID,
    // which may not exist (and whose not-found page can still have a session title).
    await page.context().clearCookies();
    await page.goto("/login");
    await loginWithPassword(page);
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await page.goto("/lorem-ipsum/test-runs");
    await expect(
      page.getByText("Lorem Ipsum", { exact: true }).first(),
    ).toBeVisible();
    await navigateToSessions(page);
    await createSession(page, prompt);
    trackCurrentSession(page);

    // Prove the generated URL resolves to this real session while authenticated.
    // The crawler context below intentionally has no auth and renders access state
    // rather than chat messages, but it must still receive the session metadata.
    await expect(getChatMessageByText(page, prompt)).toBeVisible({ timeout: 30000 });

    const sessionUrl = page.url();
    const crawlerUserAgent = await page.evaluate(() => navigator.userAgent);
    const crawlerContext = await browser.newContext({
      userAgent: crawlerUserAgent,
    });
    const crawlerPage = await crawlerContext.newPage();
    await crawlerPage.goto(sessionUrl);

    // A crawler is unauthenticated, so the UI shows the access state rather than
    // messages. Assert it is the real session route—not the not-found fallback—
    // before checking the metadata exposed for link previews.
    await expect(
      crawlerPage.getByRole("heading", { name: "Unauthorized" }),
    ).toBeVisible();
    await expect(
      crawlerPage.getByText("Page not found", { exact: true }),
    ).toHaveCount(0);
    await expect(crawlerPage).toHaveTitle(
      /^.+ \([^)]+\) · empirical-run\/lorem-ipsum-tests · Empirical$/,
    );

    await crawlerContext.close();
  });
});
