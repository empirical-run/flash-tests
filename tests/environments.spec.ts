import { test, expect } from "./fixtures";

const REPO = "empirical-run/lorem-ipsum-tests";
const ENVIRONMENTS_YAML_PATH = ".empiricalrun/ENVIRONMENTS.yaml";
const YAML_BRANCH = "staging";

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
  // GitHub API returns base64 with embedded newline chars — strip before decoding
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

function removeTestEnvEntries(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^  - slug: test-env-\d+/.test(line)) {
      skipping = true;
      // Remove preceding blank line so we don't leave orphan whitespace
      if (result.length > 0 && result[result.length - 1] === '') {
        result.pop();
      }
    } else if (/^  - /.test(line) && skipping) {
      // Reached the next env entry — stop skipping
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

    // Step 4: Navigate to Settings > Environments
    await page.goto("/");
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments', exact: true }).click();

    // TODO(agent on page): The environments page should list environments from ENVIRONMENTS.yaml. Look for the environment named testEnvSlug (which will be a string like "test-env-1742123456789") — find how the cron schedule is displayed on this page and assert both the environment name and the cron schedule '0 10 * * *' are visible.
  });
});
