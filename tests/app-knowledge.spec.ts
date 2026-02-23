import { test, expect } from "./fixtures";

test.describe("App Knowledge", () => {
  let knowledgeFileTitle: string | undefined;

  test.afterEach(async ({ page }) => {
    // Clean up: delete the knowledge file if it was created
    if (!knowledgeFileTitle) return;

    const titleToDelete = knowledgeFileTitle;
    knowledgeFileTitle = undefined;

    // Navigate to app knowledge page
    await page.goto("/lorem-ipsum/app-knowledge");
    await expect(page.getByText("Knowledge Files").first()).toBeVisible();

    // Click on the file in the list to select it
    await page.getByRole('link', { name: new RegExp(titleToDelete) }).click();

    // Click the Delete button in the content panel
    await page.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion in the confirmation dialog
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Verify the file is no longer in the list
    await expect(page.getByRole('link', { name: new RegExp(titleToDelete) })).not.toBeVisible();
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

    // Click the "+" button to open the create form
    await page.getByText('Knowledge Files').locator('..').getByRole('button').click();

    // Verify the dialog appeared
    await expect(page.getByText('Create New Knowledge File')).toBeVisible();

    // Fill in the file name
    await page.getByPlaceholder("Enter filename (e.g., 'getting-started')").fill(knowledgeFileTitle);

    // Fill in the content
    await page.getByPlaceholder('Enter initial content or leave blank for template...').fill(knowledgeFileContent);

    // Click "Create File" to save
    await page.getByRole('button', { name: 'Create File' }).click();

    // Verify the file appears in the knowledge files list
    await expect(page.getByRole('link', { name: new RegExp(knowledgeFileTitle) })).toBeVisible({ timeout: 15000 });

    // Use GitHub proxy to get the latest commit for this file
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

    // Assert that there is at least one commit for this file
    expect(commits.length).toBeGreaterThan(0);

    const latestCommit = commits[0];
    console.log('Latest commit:', JSON.stringify(latestCommit.commit, null, 2));

    // Assert that the commit author email is automation-test@example.com
    const authorEmail = latestCommit.commit.author.email;
    expect(authorEmail).toBe('automation-test@example.com');
  });
});
