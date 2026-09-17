import { test } from "./fixtures";
import { expectAppLoaded } from "./pages/home";

test("user is logged in successfully", async ({ page }) => {
  // Use the stable dashboard login entry point. The apex path may serve the
  // marketing site; authenticated users are redirected from /login into the app.
  await page.goto("/login");

  // Assert the app has loaded after successful login
  // (login steps are handled by the setup project)
  await expectAppLoaded(page);
});