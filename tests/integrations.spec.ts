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
    
    // Test 3: Jira Connect button - wait for popup instead of same-page navigation
    const jiraPopupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Connect' }).first().click();
    const jiraPopup = await jiraPopupPromise;
    await jiraPopup.waitForLoadState();
    expect(jiraPopup.url()).toContain('atlassian.com');
    await jiraPopup.close();
    
    // Test 4: Linear Connect button - wait for popup instead of same-page navigation
    const linearPopupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Connect' }).nth(1).click();
    const linearPopup = await linearPopupPromise;
    await linearPopup.waitForLoadState();
    expect(linearPopup.url()).toContain('linear.app');
    await linearPopup.close();
  });
});
