import { test, expect } from "./fixtures";

test("user can logout successfully", async ({ page }) => {
  // Navigate to the app (starting with authenticated state)
  await page.goto("/");
  
  // Verify we're initially logged in by checking for the authenticated content
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  
  // Look for common logout UI patterns and click logout
  // Try different common logout selectors/patterns
  const logoutSelectors = [
    'button[data-testid="logout"]',
    'button:has-text("Logout")',
    'button:has-text("Log out")',
    'button:has-text("Sign out")',
    'a:has-text("Logout")',
    'a:has-text("Log out")',
    'a:has-text("Sign out")',
    '[data-testid="user-menu"] button', // Click user menu first, then logout
    '[data-testid="profile-menu"] button',
    'button[aria-label="User menu"]',
    'button[aria-label="Profile menu"]',
  ];
  
  let loggedOut = false;
  
  // Try to find and click logout through various UI patterns
  for (const selector of logoutSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        await element.click();
        
        // If it's a menu button, look for logout option in the dropdown
        if (selector.includes('menu')) {
          const logoutOptions = [
            'button:has-text("Logout")',
            'button:has-text("Log out")',
            'button:has-text("Sign out")',
            'a:has-text("Logout")',
            'a:has-text("Log out")',
            'a:has-text("Sign out")',
            '[data-testid="logout"]',
          ];
          
          for (const logoutOption of logoutOptions) {
            const logoutElement = page.locator(logoutOption);
            if (await logoutElement.isVisible({ timeout: 1000 })) {
              await logoutElement.click();
              loggedOut = true;
              break;
            }
          }
        } else {
          loggedOut = true;
        }
        
        if (loggedOut) break;
      }
    } catch (error) {
      // Continue to next selector if this one fails
      continue;
    }
  }
  
  // Verify that logout was successful by checking for login elements
  // After logout, user should see login options
  await expect(
    page.locator('button:has-text("Login with password")')
  ).toBeVisible({ timeout: 10000 });
  
  // Verify that authenticated content is no longer visible
  await expect(page.getByText("Lorem Ipsum")).not.toBeVisible();
});