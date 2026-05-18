import { Page, expect } from '@playwright/test';

const REPO = "empirical-run/lorem-ipsum-tests";
const ENVIRONMENTS_YAML_PATH = ".empiricalrun/ENVIRONMENTS.yaml";
const YAML_BRANCH = "staging";
const SCHEDULER_URL = "https://scheduler.empirical-run.workers.dev/";

export async function getEnvironmentsYaml(
  page: Page,
  buildUrl: string
): Promise<{ content: string; sha: string }> {
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

export async function updateEnvironmentsYaml(
  page: Page,
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
export function removeTestEnvEntries(content: string): string {
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

export async function getSchedulerHtml(page: Page): Promise<string> {
  const auth = Buffer.from(process.env.SCHEDULER_BASIC_AUTH!).toString('base64');
  const response = await page.request.get(SCHEDULER_URL, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  expect(response.ok()).toBeTruthy();
  return await response.text();
}
