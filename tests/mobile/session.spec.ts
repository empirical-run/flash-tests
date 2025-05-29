import { test, expect } from '@playwright/test';

test.describe('Mobile Session Tests', () => {
  test('create session', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify the page loads properly on mobile (login page)
    await expect(page).toHaveTitle('Empirical');
    
    // Check if the mobile layout is properly displayed
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(414); // iPhone 13 width
    
    // Perform login steps to create a session
    await page.getByPlaceholder('m@example.com').click();
    await page.getByPlaceholder('m@example.com').fill("automation-test@example.com");
    
    await page.getByPlaceholder('●●●●●●●●').click();
    await page.getByPlaceholder('●●●●●●●●').fill("k8mSX99gDUD@E#L");
    
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    // Verify that the session was created successfully
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Verify mobile viewport is working correctly
    expect(viewport?.height).toBeGreaterThan(600); // Reasonable mobile height
    
    // Additional verification that we're in a mobile context
    // The session should work properly on mobile devices
    await expect(page.locator('body')).toBeVisible();
  });
});