import { test, expect } from "@playwright/test";

test("apply for SDET role and fill application form", async ({ page }) => {
  // Go to the hiring page
  await page.goto("https://coverself.com/hiring");

  // TODO(agent on page): Click on the SDET role to apply for it
});
