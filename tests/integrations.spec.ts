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
    
    // Test 3: Jira Connect button - verify it exists and is clickable
    const jiraConnectButton = page.getByRole('button', { name: 'Connect' }).first();
    await expect(jiraConnectButton).toBeVisible();
    await expect(jiraConnectButton).toBeEnabled();
    
    // Test 4: Linear Connect button - verify it exists and is clickable
    const linearConnectButton = page.getByRole('button', { name: 'Connect' }).nth(1);
    await expect(linearConnectButton).toBeVisible();
    await expect(linearConnectButton).toBeEnabled();
  });
});
