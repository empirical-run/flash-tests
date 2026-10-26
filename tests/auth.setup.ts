import { test as setup } from "./fixtures";
import { expectHomeLoaded } from "./pages/home";
import { loginWithPassword } from "./pages/login";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Navigate directly to the login route. The apex path may serve the
  // marketing site, while /login is the dashboard entry point on every host.
  await page.goto("/login");

  // Login with email and password
  await loginWithPassword(page);

  // Assert that the authenticated home page has loaded
  await expectHomeLoaded(page);

  // Project selection belongs to each test context (see fixtures.ts), not the
  // shared authentication state. The automatic fixture selected Lorem Ipsum for
  // this setup test too, so remove that cookie before saving the reusable login.
  await page.context().clearCookies({ name: "selected_project_slug" });

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});
