import { test, expect } from "./fixtures";

test.describe("Integrations Page", () => {
  test("verify install buttons redirect to correct URLs", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to integrations page
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Integrations' }).click();
    
    // Verify we're on the integrations page
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    
    // Test 1: GitHub Configure link - verify it has the correct href
    const githubConfigureLink = page.getByRole('link', { name: 'Configure' });
    await expect(githubConfigureLink).toBeVisible();
    const githubHref = await githubConfigureLink.getAttribute('href');
    expect(githubHref).toContain('github.com/apps/empirical-run');
    
    // Test 2: Slack Fix Permissions button - click and verify redirect
    await page.getByRole('button', { name: 'Fix Permissions' }).click();
    await page.waitForURL(/slack\.com/, { timeout: 10000 });
    expect(page.url()).toContain('slack.com');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    
    // Test 3: Jira Connect button - verify it triggers a request to atlassian.com
    const jiraRequestPromise = page.waitForRequest(request => 
      request.url().includes('atlassian.com') || 
      request.url().includes('/api/integrations/jira')
    , { timeout: 10000 });
    await page.getByRole('button', { name: 'Connect' }).first().click();
    const jiraRequest = await jiraRequestPromise;
    expect(jiraRequest.url()).toMatch(/(atlassian\.com|\/api\/integrations\/jira)/);
    
    // Wait a moment for any navigation or modal to appear
    await page.waitForTimeout(1000);
    
    // If a navigation occurred, go back
    if (!page.url().includes('integrations')) {
      await page.goBack();
    }
    
    // Ensure we're back on integrations page
    await page.goto(page.url().split('#')[0].split('?')[0].replace(/\/[^\/]*$/, '') + '/lorem-ipsum/settings/integrations');
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    
    // Test 4: Linear Connect button - verify it triggers a request to linear.app
    const linearRequestPromise = page.waitForRequest(request => 
      request.url().includes('linear.app') || 
      request.url().includes('/api/integrations/linear')
    , { timeout: 10000 });
    await page.getByRole('button', { name: 'Connect' }).nth(1).click();
    const linearRequest = await linearRequestPromise;
    expect(linearRequest.url()).toMatch(/(linear\.app|\/api\/integrations\/linear)/);
  });
});
