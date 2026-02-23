import { test, expect } from "./fixtures";

test.describe("App Knowledge", () => {
  let knowledgeFileTitle: string | undefined;

  test.afterEach(async ({ page }) => {
    if (!knowledgeFileTitle) return;

    const titleToDelete = knowledgeFileTitle;
    knowledgeFileTitle = undefined;

    // Navigate directly to the file via URL so the correct file is selected in the content panel
    await page.goto(`/lorem-ipsum/app-knowledge?file=.empiricalrun%2F${titleToDelete}.md`);

    // Verify the correct file is loaded in the content panel
    await expect(page.locator('h2').filter({ hasText: titleToDelete }).first()).toBeVisible({ timeout: 10000 });

    // Click the Delete button in the content panel header to open the confirmation dialog
    await page.getByRole('button', { name: 'Delete' }).click();

    // The confirmation dialog shows "Delete Knowledge File" with Cancel and Delete buttons
    await expect(page.getByText('Delete Knowledge File')).toBeVisible();

    // Click the Delete button in the confirmation dialog
    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify the file is removed from the sidebar list
    await expect(page.getByRole('link', { name: new RegExp(titleToDelete) })).not.toBeVisible({ timeout: 10000 });
  });

  test("add knowledge file from sidebar and verify commit author in GitHub", async ({ page }) => {
    const timestamp = Date.now();
    knowledgeFileTitle = `test-knowledge-${timestamp}`;
    const knowledgeFileContent = `This is test content for knowledge file ${timestamp}`;

    // Navigate to the app
    await page.goto("/");
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();

    // Navigate to App Knowledge from the sidebar
    await page.getByRole('link', { name: 'App Knowledge' }).click();

    // Verify we're on the app knowledge page
    await expect(page).toHaveURL(/app-knowledge/);
    await expect(page.getByText("Knowledge Files").first()).toBeVisible();

    // Click the "+" button next to "Knowledge Files" heading to open the create form
    await page.getByText('Knowledge Files').locator('..').getByRole('button').click();

    // Verify the create dialog appeared
    await expect(page.getByText('Create New Knowledge File')).toBeVisible();

    // Fill in the file name (without .md extension - it's added automatically)
    await page.getByPlaceholder("Enter filename (e.g., 'getting-started')").fill(knowledgeFileTitle);

    // Fill in the content
    await page.getByPlaceholder('Enter initial content or leave blank for template...').fill(knowledgeFileContent);

    // Click "Create File" to save
    await page.getByRole('button', { name: 'Create File' }).click();

    // After creation the app shows the new file in the content panel
    // Assert the content panel heading contains the new file name
    await expect(page.locator('h2').filter({ hasText: knowledgeFileTitle }).first()).toBeVisible({ timeout: 15000 });

    // Also assert the content we entered is visible
    await expect(page.getByText(knowledgeFileContent).first()).toBeVisible();

    // Use GitHub proxy to get the latest commit for this file in the repo
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const filePath = `.empiricalrun/${knowledgeFileTitle}.md`;

    const commitsResponse = await page.request.post(`${buildUrl}/api/github/proxy`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        method: 'GET',
        url: `/repos/empirical-run/lorem-ipsum-tests/commits?path=${encodeURIComponent(filePath)}&per_page=1&sha=staging`
      }
    });

    expect(commitsResponse.ok()).toBeTruthy();

    const commits = await commitsResponse.json();
    console.log('Commits response:', JSON.stringify(commits, null, 2));

    // Assert that there is at least one commit for this file
    expect(commits.length).toBeGreaterThan(0);

    const latestCommit = commits[0];

    // Assert that the commit author email is automation-test@example.com
    expect(latestCommit.commit.author.email).toBe('automation-test@example.com');
  });
});
