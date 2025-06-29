import { test, expect } from "../fixtures";
import { CliAuthPage } from "../pages/cli";

test.describe("CLI Authentication - Logged Out State", () => {
  let cliAuthPage: CliAuthPage;

  test.beforeEach(async ({ page }) => {
    cliAuthPage = new CliAuthPage(page);
  });

  test.afterEach(async () => {
    await cliAuthPage.cleanup();
  });

  test("investigate CLI auth behavior when logged out", async ({ page }) => {
    await page.goto("/");
    // TODO(agent on page): Navigate to CLI auth page (/auth/cli?redirect_uri=http://localhost:8080/callback) and check what happens when user is not logged in
  });
});