import { test } from "./fixtures";
import { expectHomePageLoaded } from "./pages/home";

test("user is logged in successfully", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  // (login steps are handled by the setup project)
  await expectHomePageLoaded(page);
});