import { Page, test as base } from "@playwright/test";
import { baseTestFixture } from "@empiricalrun/playwright-utils/test";
import { UserContext, productionUserContext } from "../test-data";

export type TestOptions = {
  loggedInPage: Page;
  userContext: UserContext;
};

export const test = baseTestFixture(base).extend<TestOptions>({
  userContext: [productionUserContext, { option: true }],
  page: async ({ page }, use) => {
    // Navigate to the baseURL defined in playwright.config.ts
    await page.goto("/");
    await use(page);
  },
  loggedInPage: async ({ page, userContext }, use) => {
    await page.locator('input[type="email"]').fill(userContext.email);
    await page.locator('input[type="password"]').fill(userContext.password);
    await page.locator('button[type="submit"]').click();
    await page.getByRole("button", { name: "Add" }).waitFor();
    await use(page);
  },
});

export const expect = test.expect;
