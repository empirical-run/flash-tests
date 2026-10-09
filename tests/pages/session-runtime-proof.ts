import { expect, Locator, Page } from '@playwright/test';
import { getApiWorkerAuthHeaders } from './api-auth';
import { getApiBaseUrl } from './urls';

/** A card must be displayed in this response and identify the actual pushed SHA. */
export function getCommitCardForSha(response: Locator, sha: string): Locator {
  expect(sha).toMatch(/^[a-f0-9]{40}$/i);
  return response.getByRole('button', { name: /\bCommit created\b.*\bView changes\b/i })
    .and(response.locator(`[title="Commit ${sha}"]`));
}

/** Read GitHub's PR head independently; never obtain a SHA from a commit card/diff. */
export async function getDisplayedPrHead(page: Page, baseBranch: string, headBranch: string, expectedParentSha: string) {
  const headerButton = page.locator('main header').getByRole('button', { name: /PR #\d+/ });
  await expect(headerButton).toHaveCount(1);
  const number = Number((await headerButton.innerText()).match(/PR #(\d+)/)?.[1]);
  expect(number).toBeGreaterThan(0);
  const response = await page.request.post(`${getApiBaseUrl()}/api/github/proxy`, {
    headers: await getApiWorkerAuthHeaders(page),
    data: { method: 'GET', url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${number}`, owner: 'empirical-run' },
  });
  expect(response.ok()).toBeTruthy();
  const pr = await response.json();
  expect(pr.number).toBe(number);
  expect(pr.state).toBe('open');
  expect(pr.base.ref).toBe(baseBranch);
  expect(pr.head.repo.full_name).toBe('empirical-run/lorem-ipsum-tests');
  expect(pr.head.ref).toBe(headBranch);
  expect(pr.head.sha).toMatch(/^[a-f0-9]{40}$/i);
  expect(pr.base.sha).toBe(expectedParentSha);
  const commitResponse = await page.request.post(`${getApiBaseUrl()}/api/github/proxy`, {
    headers: await getApiWorkerAuthHeaders(page),
    data: { method: 'GET', url: `/repos/empirical-run/lorem-ipsum-tests/commits/${pr.head.sha}`, owner: 'empirical-run' },
  });
  expect(commitResponse.ok()).toBeTruthy();
  const commit = await commitResponse.json();
  expect(commit.sha).toBe(pr.head.sha);
  expect(commit.parents.map((parent: { sha: string }) => parent.sha), 'Current owned base established before the commit').toContain(expectedParentSha);
  return { number, sha: pr.head.sha as string };
}

/** The tool's own expanded Input is the UI's untruncated command contract. */
export function getBashInput(tool: Locator): Locator {
  return tool.locator('..').getByTestId('inline-tool-details').locator('section')
    .filter({ has: tool.page().getByRole('heading', { name: 'Input', exact: true }) }).locator('pre');
}

export async function openBashWithFullCommand(response: Locator, command: string, status: 'running' | 'used') {
  // Only one bash call is allowed in this deliberately single-command turn.
  // No first()/last(), summary matching, or other-turn fallback.
  const tool = response.getByTestId(`${status}-bash`);
  await expect(tool).toHaveCount(1, { timeout: 120000 });
  await tool.click();
  const input = getBashInput(tool);
  await expect(input).toBeVisible();
  expect(JSON.parse(await input.innerText()).command, 'Actual full UI tool command').toBe(command);
  await expect(tool).toBeVisible();
  return tool;
}

export function getBashOutput(tool: Locator): Locator {
  return tool.locator('..').getByTestId('inline-tool-details').locator('section')
    .filter({ has: tool.page().getByRole('heading', { name: 'Output', exact: true }) });
}
