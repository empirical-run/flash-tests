import { expect, Page } from "@playwright/test";
import { getDashboardBaseUrl } from "./urls";

export type CurrentUser = {
  id: string;
  email: string;
  org_ids: number[];
  is_super_admin: boolean;
};

/** Signed-in user from the dashboard session (absolute URL: custom contexts have no baseURL). */
export async function getCurrentUser(page: Page): Promise<CurrentUser> {
  const response = await page.request.get(
    `${getDashboardBaseUrl()}/api/users/me`,
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
}
