import { test, expect } from "./fixtures";
import { CliAuthPage } from "./pages/cli";

test.describe("CLI Authentication", () => {
  let cliAuthPage: CliAuthPage;

  test.beforeEach(async ({ page }) => {
    cliAuthPage = new CliAuthPage(page);
  });

  test.afterEach(async () => {
    await cliAuthPage.cleanup();
  });

test("investigate CLI auth page content", async ({ page }) => {
    // Navigate to CLI auth page with redirect URI  
    await page.goto(cliAuthPage.getCliAuthUrl());
    
    // TODO(agent on page): Take screenshot and check what text messages are actually displayed on the CLI authentication page
  });
});