import { test as base, expect } from "../fixtures";
import { getApiWorkerAuthHeaders } from "../pages/api-auth";
import { expectHomeLoaded } from "../pages/home";
import { loginWithPassword } from "../pages/login";
import { expectCanonicalSessionTitle } from "../pages/session-title";
import {
  createWorkerSession,
  getChatMessageByText,
  navigateToSessions,
} from "../pages/sessions";
import { getApiBaseUrl } from "../pages/urls";

const test = base.extend<{
  redirectSession: { id: number; path: string; prompt: string };
}>({
  redirectSession: async ({ page }, use) => {
    await page.goto("/login");
    await loginWithPassword(page);
    await expectHomeLoaded(page);
    // Login may restore another project; select the fixture project explicitly.
    await page.goto("/lorem-ipsum/test-runs");
    await expect(
      page.getByText("Lorem Ipsum", { exact: true }).first(),
    ).toBeVisible();
    await navigateToSessions(page);
    const prompt = `Login redirect fixture ${Date.now()}: reply OK without using tools.`;
    const headers = await getApiWorkerAuthHeaders(page);
    const id = await createWorkerSession(page, prompt);

    await use({ id, path: `/sessions/${id}`, prompt });

    // Fixture-owned teardown runs even if redirect assertions fail. The creator
    // stays authenticated; never close a shared or hard-coded session.
    const response = await page.request.post(
      `${getApiBaseUrl()}/api/chat-sessions/${id}/close`,
      { headers },
    );
    await expect(response).toBeOK();
    await expect
      .poll(async () => {
        const readback = await page.request.get(
          `${getApiBaseUrl()}/api/chat-sessions/${id}`,
          { headers },
        );
        await expect(readback).toBeOK();
        return (await readback.json()).data.chat_session.is_closed;
      })
      .toBe(true);
  },
});

test.describe("Session Redirect After Login", () => {
  test.skip(
    process.env.TEST_RUN_ENVIRONMENT !== "preview",
    "This test only runs on preview environments",
  );

  test("navigate to protected session URL as non-logged user and redirect after login", async ({
    customContextPageProvider,
    redirectSession,
    baseURL,
  }) => {
    const { page } = await customContextPageProvider({
      baseURL,
      storageState: undefined,
    });

    // The new context has no creator cookies and visits this attempt's worker.
    await page.goto(redirectSession.path);
    await expect(page).toHaveURL(/login/);
    await loginWithPassword(page);
    await expect(page).toHaveURL(redirectSession.path);

    // Prove this is the created session, not just a matching URL or app shell.
    await expect(
      getChatMessageByText(page, redirectSession.prompt),
    ).toBeVisible({ timeout: 30000 });

    await page
      .getByRole("button")
      .filter({ hasText: "Review" })
      .locator("..")
      .locator(".lucide-chevron-down")
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Close Session" }),
    ).toBeVisible();

    await expectCanonicalSessionTitle(page, redirectSession.id);
  });
});
