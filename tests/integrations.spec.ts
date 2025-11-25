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
    
    // Verify all 4 integration options are present
    await expect(page.getByRole('heading', { name: 'GitHub', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Slack', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Jira', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Linear', exact: true })).toBeVisible();
    
    // Test 1: GitHub Install button - click and verify redirect
    // Find the GitHub heading and get the button in the same section
    const githubCard = page.getByRole('heading', { name: 'GitHub', exact: true }).locator('..');
    const githubButton = githubCard.getByRole('button', { name: 'Install' });
    await expect(githubButton).toBeVisible();
    await githubButton.click();
    await page.waitForURL(/github\.com/, { timeout: 10000 });
    expect(page.url()).toContain('github.com/apps/empirical-run');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    
    // Test 2: Slack Fix Permissions button - click and verify redirect
    await page.getByRole('button', { name: 'Fix Permissions' }).click();
    await page.waitForURL(/slack\.com/, { timeout: 10000 });
    expect(page.url()).toContain('slack.com');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    
    // Test 3: Jira Connect button - click and verify it opens in new tab
    const jiraConnectButton = page.locator('div').filter({ hasText: /^Jira/ }).getByRole('button').first();
    await expect(jiraConnectButton).toBeVisible();
    
    const [jiraPopup] = await Promise.all([
      page.waitForEvent('popup'),
      jiraConnectButton.click()
    ]);
    
    await jiraPopup.waitForLoadState();
    expect(jiraPopup.url()).toMatch(/atlassian\.net|atlassian\.com/);
    await jiraPopup.close();
    
    // Verify we're still on integrations page
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    
    // Test 4: Linear Connect button - click and verify it opens in new tab
    const linearConnectButton = page.locator('div').filter({ hasText: /^Linear/ }).getByRole('button').first();
    await expect(linearConnectButton).toBeVisible();
    
    const [linearPopup] = await Promise.all([
      page.waitForEvent('popup'),
      linearConnectButton.click()
    ]);
    
    await linearPopup.waitForLoadState();
    expect(linearPopup.url()).toContain('linear.app');
    await linearPopup.close();
    
    // Verify we're still on integrations page
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
  });
});
