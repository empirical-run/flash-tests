import { test, expect } from "./fixtures";

test.describe("Integrations Page", () => {
  test("verify install buttons redirect to correct URLs", async ({ page, context }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to integrations page
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Integrations' }).click();
    
    // Verify we're on the integrations page
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    
    // Test 1: GitHub Configure button
    const githubConfigurePromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Configure' }).click();
    const githubPage = await githubConfigurePromise;
    await githubPage.waitForLoadState();
    expect(githubPage.url()).toContain('github.com/apps/empirical-run');
    await githubPage.close();
    
    // Test 2: Slack Fix Permissions button
    const slackPermissionsPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Fix Permissions' }).click();
    const slackPage = await slackPermissionsPromise;
    await slackPage.waitForLoadState();
    expect(slackPage.url()).toContain('slack.com');
    await slackPage.close();
    
    // Test 3: Jira Connect button
    const jiraConnectPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Connect' }).first().click();
    const jiraPage = await jiraConnectPromise;
    await jiraPage.waitForLoadState();
    expect(jiraPage.url()).toContain('atlassian.com');
    await jiraPage.close();
    
    // Test 4: Linear Connect button
    const linearConnectPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Connect' }).nth(1).click();
    const linearPage = await linearConnectPromise;
    await linearPage.waitForLoadState();
    expect(linearPage.url()).toContain('linear.app');
    await linearPage.close();
  });
});
