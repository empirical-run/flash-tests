import { test, expect } from "./fixtures";
import { navigateToSettings } from "./pages/settings";

test.describe("Integrations Page", () => {
  test("verify install buttons redirect to correct URLs", async ({ page }) => {
    // GitHub and Slack integrations are now on the Reporters settings page
    await navigateToSettings(page, 'Reporters');
    
    // Verify GitHub and Slack integration options are present
    await expect(page.getByText('GitHub', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Slack', { exact: true }).first()).toBeVisible();
    
    // Test 1: GitHub link - verify href (works with both "Configure" and "Install")
    const githubLink = page.locator('div').filter({ hasText: /^GitHub/ }).getByRole('link').first();
    await expect(githubLink).toBeVisible();
    const githubHref = await githubLink.getAttribute('href');
    expect(githubHref).toContain('github.com/apps/empirical-run');
    
    // Test 2: Slack button - click and verify redirect
    const slackButton = page.locator('div').filter({ hasText: /^Slack/ }).getByRole('button').first();
    await slackButton.click();
    await page.waitForURL(/slack\.com/);
    expect(page.url()).toContain('slack.com');
    await page.goBack();
    await expect(page.getByText('GitHub', { exact: true }).first()).toBeVisible();
    
    // Jira and Linear integrations are now on the Requests settings page
    await navigateToSettings(page, 'Requests');
    
    // Verify Jira and Linear integration options are present
    await expect(page.getByText('Jira', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Linear', { exact: true }).first()).toBeVisible();
    
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
    
    // Verify we're still on Requests page
    await expect(page.getByText('Jira', { exact: true }).first()).toBeVisible();
    
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
    
    // Verify we're still on Requests page
    await expect(page.getByText('Jira', { exact: true }).first()).toBeVisible();
  });
});
