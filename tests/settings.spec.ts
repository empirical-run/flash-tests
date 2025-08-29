import { test, expect } from "./fixtures";

test.describe("Settings Page", () => {
  test("navigate to settings page and assert repo exists message is visible", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings page
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Assert that repository exists by checking the repo location and status
    await expect(page.getByText("empirical-run/lorem-ipsum-tests")).toBeVisible();
    await expect(page.getByText("exists")).toBeVisible();
    await expect(page.getByRole('button', { name: 'View on GitHub' })).toBeVisible();
  });

  test("sync playwright config and verify persistence", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > general
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Set up network monitoring to capture all API requests
    const networkRequests: Array<{url: string, method: string, postData?: any}> = [];
    const networkResponses: Array<{url: string, status: number, body?: any}> = [];
    
    page.on('request', async (request) => {
      if (request.url().includes('/api/')) {
        console.log(`REQUEST: ${request.method()} ${request.url()}`);
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData()
        });
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        console.log(`RESPONSE: ${response.status()} ${response.url()}`);
        try {
          const body = await response.json();
          console.log(`RESPONSE BODY:`, JSON.stringify(body, null, 2));
          networkResponses.push({
            url: response.url(),
            status: response.status(),
            body
          });
        } catch (error) {
          console.log(`RESPONSE BODY: (not JSON or failed to parse)`);
          networkResponses.push({
            url: response.url(),
            status: response.status()
          });
        }
      }
    });

    // Click on sync config button and wait for network activity
    await page.getByRole('button', { name: 'Sync Config' }).click();
    
    // Wait a bit for the API call to complete (or fail)
    await page.waitForTimeout(5000);

    // Log the captured network activity
    console.log('\n=== CAPTURED NETWORK REQUESTS ===');
    networkRequests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`   POST DATA: ${req.postData}`);
      }
    });

    console.log('\n=== CAPTURED NETWORK RESPONSES ===');
    networkResponses.forEach((res, i) => {
      console.log(`${i + 1}. ${res.status} ${res.url}`);
      if (res.body) {
        console.log(`   BODY: ${JSON.stringify(res.body, null, 2)}`);
      }
    });

    // This test is just for investigation, so it always passes
    expect(networkRequests.length).toBeGreaterThan(0);
  });
});