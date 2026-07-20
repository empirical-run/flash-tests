import { test, expect } from "./fixtures";
import { loginViaReturnToRedirect } from "./pages/login";

test.describe("ReturnTo Redirection", () => {
  test("returnTo without query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page and verify the login returnTo redirect flow
    await loginViaReturnToRedirect(page, "/lorem-ipsum/memories");

    // Verify we're on the memories page. Scope to visible page content because
    // the new responsive nav can include hidden duplicate labels.
    await expect(page.locator('main').getByText('Memories', { exact: true })).toBeVisible();
  });

  test("returnTo with query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page with session ID in path and verify the
    // login returnTo redirect flow preserves the full path
    await loginViaReturnToRedirect(page, "/sessions/39626");
  });
});
