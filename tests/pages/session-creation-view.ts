import { Page, expect } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";

/** Verify a newly authenticated user's records and the actual Sessions zero state. */
export async function expectNewUserEmptySessions(
  page: Page,
  email: string,
): Promise<void> {
  await expect(page).toHaveURL(/\/sessions$/);
  const headers = await getApiWorkerAuthHeaders(page);
  const userResponse = await page.request.get(
    `${getApiBaseUrl()}/api/users/me`,
    { headers },
  );
  expect(userResponse.ok()).toBe(true);
  const { data: user } = await userResponse.json();
  expect(user.email).toBe(email);
  expect(user.id).toMatch(/^[0-9a-f-]{36}$/);

  const sessionsResponse = await page.request.get(
    `${getApiBaseUrl()}/api/chat-sessions`,
    {
      headers,
      params: { page: 1, per_page: 25, show_closed: true, user_ids: user.id },
    },
  );
  expect(sessionsResponse.ok()).toBe(true);
  const sessions = await sessionsResponse.json();
  expect(sessions.pagination.filter_state.userIds).toEqual([user.id]);
  expect(sessions.data).toEqual([]);

  const main = page.getByRole("main");
  await expect(
    main.getByText("No sessions found", { exact: true }),
  ).toBeVisible();
  await expect(main.locator('a[href^="/sessions/"]')).toHaveCount(0);
  await expect(
    main.getByRole("heading", { name: "Create a new session", exact: true }),
  ).toBeVisible();
  const prompt = main.getByRole("textbox", {
    name: "Enter a prompt to start a session",
    exact: true,
  });
  await expect(prompt).toBeVisible();
  await expect(prompt).toBeEnabled();
}
