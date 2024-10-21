import { Page, test as base } from "@playwright/test";
import { baseTestFixture } from "@empiricalrun/playwright-utils/test";
import { UserContext, productionUserContext } from "../test-data";

export type TestOptions = {
  loggedInPage: Page;
  userContext: UserContext;
};

export const test = baseTestFixture(base).extend<TestOptions>({
  userContext: [productionUserContext, { option: true }],
  page: async ({ page, userContext }, use) => {
    await page.goto(userContext.domain);
    use(page);
  },
  loggedInPage: async ({ page, userContext }, use) => {
    await page.fill('input[type="email"]', userContext.email);
    await page.fill('input[type="password"]', userContext.password);
    await page.click('button[type="submit"]');
    await page.getByRole("button", { name: "Add" }).waitFor();
    use(page);
  },
});

export const expect = test.expect;
