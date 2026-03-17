import { test, expect } from "./fixtures";

const REPO = "empirical-run/lorem-ipsum-tests";
const ENVIRONMENTS_YAML_PATH = ".empiricalrun/ENVIRONMENTS.yaml";
const YAML_BRANCH = "staging";
const SCHEDULER_URL = "https://scheduler.empirical-run.workers.dev/";

async function getYamlFile(page: any, buildUrl: string): Promise<{ content: string; sha: string }> {
  const response = await page.request.post(`${buildUrl}/api/github/proxy`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      method: 'GET',
      url: `/repos/${REPO}/contents/${ENVIRONMENTS_YAML_PATH}?ref=${YAML_BRANCH}`
    }
  });
  if (!response.ok()) {
    throw new Error(`Failed to get YAML file: ${response.status()}`);
  }
  const data = await response.json();
  // GitHub API base64 has embedded newline characters — strip them before decoding
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

async function updateYamlFile(
  page: any,
  buildUrl: string,
  content: string,
  sha: string,
  message: string
): Promise<void> {
  const response = await page.request.post(`${buildUrl}/api/github/proxy`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      method: 'PUT',
      url: `/repos/${REPO}/contents/${ENVIRONMENTS_YAML_PATH}`,
      body: {
        message,
        content: Buffer.from(content).toString('base64'),
        sha,
        branch: YAML_BRANCH
      }
    }
  });
  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to update YAML file: ${response.status()} - ${errorText}`);
  }
}

/**
 * Removes all test environment entries (slugs matching test-env-\d+) from the YAML content.
 * Each YAML list entry starts with "  - slug: ...". We skip lines until the next entry or EOF.
 */
function removeTestEnvEntries(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^  - slug: test-env-\d+/.test(line)) {
      skipping = true;
      // Remove preceding blank line to avoid orphan whitespace
      if (result.length > 0 && result[result.length - 1] === '') {
        result.pop();
      }
    } else if (/^  - /.test(line) && skipping) {
      // Next entry starts — stop skipping
      skipping = false;
      result.push(line);
    } else if (!skipping) {
      result.push(line);
    }
  }

  return result.join('\n');
}

test.describe("Environment with Cron Schedule", () => {
  let testEnvSlug: string;
  const cronSchedule = '0 10 * * *';

  test.beforeEach(async () => {
    const timestamp = Date.now();
    testEnvSlug = `test-env-${timestamp}`;
  });

  test.afterEach(async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const { content, sha } = await getYamlFile(page, buildUrl);
    const cleanedContent = removeTestEnvEntries(content);
    if (cleanedContent !== content) {
      await updateYamlFile(
        page,
        buildUrl,
        cleanedContent,
        sha,
        "chore: cleanup test environments"
      );
    }
  });

  test("add environment with cron schedule and verify in UI", async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";

    // Step 1: Get current ENVIRONMENTS.yaml content and SHA
    const { content: originalContent, sha } = await getYamlFile(page, buildUrl);

    // Step 2: Append new environment entry with cron schedule
    const newEnvEntry = [
      ``,
      `  - slug: ${testEnvSlug}`,
      `    name: ${testEnvSlug}`,
      `    scheduled_trigger: '${cronSchedule}'`,
      ``
    ].join('\n');
    const updatedContent = originalContent.trimEnd() + '\n' + newEnvEntry;

    // Step 3: Commit updated file to GitHub
    await updateYamlFile(
      page,
      buildUrl,
      updatedContent,
      sha,
      `test: add ${testEnvSlug} environment with cron schedule`
    );

    // Step 4: Navigate directly to the Environments settings page
    await page.goto("/lorem-ipsum/settings/environments");

    // Step 5: Wait for the new environment row to appear in the table.
    // The webhook from the GitHub commit fires async, so the page may load
    // before the backend has processed the sync. We poll with page reloads.
    await expect.poll(async () => {
      await page.reload();
      // Wait for the table to fully load (at least one existing row visible)
      await expect(page.getByRole('row').filter({ hasText: 'staging' })).toBeVisible();
      return await page.getByRole('row').filter({ hasText: testEnvSlug }).count();
    }, {
      intervals: [3000, 5000, 5000, 5000, 10000, 10000, 10000],
      timeout: 60000
    }).toBeGreaterThan(0);

    const envRow = page.getByRole('row').filter({ hasText: testEnvSlug });

    // Step 7: Assert the Scheduled Trigger cell shows the cron expression (not '--')
    // Scheduled Trigger is the 4th column (index 3): Name, Slug, Playwright Projects, Scheduled Trigger
    const scheduledTriggerCell = envRow.getByRole('cell').nth(3);
    await expect(scheduledTriggerCell).not.toHaveText('--');

    // Also verify the cron parts are individually visible in the cell
    await expect(scheduledTriggerCell).toContainText('0');
    await expect(scheduledTriggerCell).toContainText('10');

    // Production-only: check that the cron is registered in the scheduler worker
    if (process.env.TEST_RUN_ENVIRONMENT === 'production') {
      // TODO: blocked on basic auth creds for scheduler.empirical-run.workers.dev
    }
  });
});
