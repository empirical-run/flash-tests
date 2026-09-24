import { Page, expect } from '@playwright/test';
import { generateUniqueBranchName } from './branch-name';
import { createBranchFromStaging, createPullRequest, deleteBranch } from './github';

const REPO = "empirical-run/lorem-ipsum-tests";
const ENVIRONMENTS_YAML_PATH = ".empiricalrun/ENVIRONMENTS.yaml";
const YAML_BRANCH = "staging";
const SCHEDULER_URL = "https://scheduler.empirical-run.workers.dev/";

export async function getEnvironmentsYaml(
  page: Page,
  buildUrl: string,
  branch = YAML_BRANCH
): Promise<{ content: string; sha: string }> {
  const response = await page.request.post(`${buildUrl}/api/github/proxy`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      method: 'GET',
      url: `/repos/${REPO}/contents/${ENVIRONMENTS_YAML_PATH}?ref=${branch}`
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

export async function updateEnvironmentsYaml(
  page: Page,
  buildUrl: string,
  content: string,
  sha: string,
  message: string,
  branch: string
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
        branch
      }
    }
  });
  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to update YAML file: ${response.status()} - ${errorText}`);
  }
}

/**
 * Commit an environments YAML change through a PR instead of pushing to the
 * protected staging branch. The scheduler syncs staging, so leaving the change
 * on the throwaway head branch alone would not exercise registration.
 */
export async function mergeEnvironmentsYamlChange(
  page: Page,
  buildUrl: string,
  content: string,
  message: string
): Promise<void> {
  const branch = generateUniqueBranchName('cron-environment-test');
  await createBranchFromStaging(page, branch);
  let openPrNumber: number | undefined;
  try {
    const { sha } = await getEnvironmentsYaml(page, buildUrl, branch);
    await updateEnvironmentsYaml(page, buildUrl, content, sha, message, branch);
    const pr = await createPullRequest(page, message, branch, YAML_BRANCH, 'Temporary scheduler cron E2E fixture', buildUrl);
    openPrNumber = pr.number;

    // GitHub can still be calculating mergeability immediately after PR creation.
    await expect.poll(async () => {
      const response = await page.request.post(`${buildUrl}/api/github/proxy`, {
        data: {
          method: 'PUT',
          url: `/repos/${REPO}/pulls/${pr.number}/merge`,
          body: { merge_method: 'merge' }
        }
      });
      if (response.ok()) {
        openPrNumber = undefined;
        return 'merged';
      }
      if (response.status() === 405) return 'pending';
      throw new Error(`Failed to merge environments PR #${pr.number}: ${response.status()} - ${await response.text()}`);
    }, { intervals: [1000, 2000, 3000], timeout: 30000 }).toBe('merged');
  } finally {
    if (openPrNumber !== undefined) {
      await page.request.post(`${buildUrl}/api/github/proxy`, {
        data: {
          method: 'PATCH',
          url: `/repos/${REPO}/pulls/${openPrNumber}`,
          body: { state: 'closed' }
        }
      });
    }
    await deleteBranch(page, branch, buildUrl);
  }
}

/**
 * Removes all test environment entries from the YAML content.
 * Each YAML list entry starts with "  - slug: ...". We skip lines until the next entry or EOF.
 */
export function removeTestEnvEntries(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^  - slug: test-env-[a-z0-9-]+$/.test(line)) {
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

function getSchedulerAuthHeader(): string {
  const auth = Buffer.from(process.env.SCHEDULER_BASIC_AUTH!).toString('base64');
  return `Basic ${auth}`;
}

export async function getSchedulerHtml(page: Page): Promise<string> {
  const response = await page.request.get(SCHEDULER_URL, {
    headers: { 'Authorization': getSchedulerAuthHeader() }
  });
  expect(response.ok()).toBeTruthy();
  return await response.text();
}

