import { test } from "./fixtures";
import { expectAppLoaded } from "./pages/home";

test("user is logged in successfully", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");

  // Assert the app has loaded after successful login
  // (login steps are handled by the setup project)
  await expectAppLoaded(page);
});