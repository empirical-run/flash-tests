import { Page } from '@playwright/test';
import { getDashboardBaseUrl } from './urls';

/**
 * Gets the SHA of a branch from GitHub
 * @param page The Playwright page object
 * @param branchName The name of the branch
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 * @returns The SHA of the branch
 */
export async function getBranchSha(
  page: Page,
  branchName: string,
  buildUrl?: string
): Promise<string> {
  const baseUrl = buildUrl || getDashboardBaseUrl();
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/branches/${branchName}`,
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to get branch ${branchName}: ${response.status()}`);
  }
  
  const branchData = await response.json();
  return branchData.commit.sha;
}

/**
 * Creates a new branch on GitHub
 * @param page The Playwright page object
 * @param branchName The name of the new branch to create
 * @param fromSha The SHA to create the branch from
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 */
export async function createBranch(
  page: Page,
  branchName: string,
  fromSha: string,
  buildUrl?: string
): Promise<void> {
  const baseUrl = buildUrl || getDashboardBaseUrl();
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'POST',
      url: '/repos/empirical-run/lorem-ipsum-tests/git/refs',
      body: {
        ref: `refs/heads/${branchName}`,
        sha: fromSha
      }
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create branch ${branchName}: ${response.status()}`);
  }
}

/**
 * Deletes a branch on GitHub
 * @param page The Playwright page object
 * @param branchName The name of the branch to delete
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 */
export async function deleteBranch(
  page: Page,
  branchName: string,
  buildUrl?: string
): Promise<void> {
  const baseUrl = buildUrl || getDashboardBaseUrl();
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'DELETE',
      url: `/repos/empirical-run/lorem-ipsum-tests/git/refs/heads/${branchName}`,
    }
  });
  
  // 404 and 422 both mean the ref no longer exists (e.g. auto-deleted after the test run
  // completed, or the backend never provisioned it) — treat as success.
  // GitHub returns 422 "Reference does not exist" on DELETE in some cases instead of 404.
  if (!response.ok() && response.status() !== 404 && response.status() !== 422) {
    throw new Error(`Failed to delete branch ${branchName}: ${response.status()}`);
  }
}

/**
 * Minimal shape of the pull request fields the tests rely on.
 */
export interface PullRequestSummary {
  number: number;
  title: string;
}

/**
 * Gets the most recent open pull request in the repo.
 * Lists open PRs sorted by creation time (newest first) and returns the first one.
 *
 * @param page The Playwright page object
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 * @returns The most recent open PR data from GitHub, or undefined if none are open
 */
export async function getMostRecentOpenPullRequest(
  page: Page,
  buildUrl?: string
): Promise<PullRequestSummary | undefined> {
  const baseUrl = buildUrl || getDashboardBaseUrl();

  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/pulls?state=open&sort=created&direction=desc&per_page=1`,
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to list open PRs: ${response.status()}`);
  }

  const pulls = await response.json();
  return Array.isArray(pulls) ? pulls[0] : undefined;
}

/**
 * Creates a pull request on GitHub
 * @param page The Playwright page object
 * @param title The PR title
 * @param head The head branch name
 * @param base The base branch name
 * @param body The PR body/description
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 * @returns The PR data from GitHub
 */
export async function createPullRequest(
  page: Page,
  title: string,
  head: string,
  base: string,
  body: string,
  buildUrl?: string
): Promise<any> {
  const baseUrl = buildUrl || getDashboardBaseUrl();
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'POST',
      url: '/repos/empirical-run/lorem-ipsum-tests/pulls',
      body: {
        title,
        head,
        base,
        body
      }
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to create PR: ${response.status()}`);
  }
  
  return await response.json();
}

/**
 * Creates a new branch off the staging branch via GitHub proxy API.
 * Fetches the current SHA of staging and creates the new branch from it.
 *
 * This is a convenience helper that combines getBranchSha + createBranch for the
 * common test setup pattern where a fresh branch needs to be forked from staging.
 *
 * @param page The Playwright page object
 * @param branchName The name of the new branch to create
 */
export async function createBranchFromStaging(page: Page, branchName: string): Promise<void> {
  const sha = await getBranchSha(page, 'staging');
  await createBranch(page, branchName, sha);
}

/**
 * Gets PR details from GitHub
 * @param page The Playwright page object
 * @param prNumber The PR number
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 * @returns The PR data from GitHub
 */
export async function getPullRequest(
  page: Page,
  prNumber: number,
  buildUrl?: string
): Promise<any> {
  const baseUrl = buildUrl || getDashboardBaseUrl();
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}`,
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to get PR ${prNumber}: ${response.status()}`);
  }
  
  return await response.json();
}

/**
 * Gets the base branch (base.ref) of a PR from GitHub.
 *
 * Used as a guardrail before merging a session's PR: callers can assert the PR
 * actually targets a throwaway branch and not a shared branch like staging.
 *
 * @param page The Playwright page object
 * @param prNumber The PR number
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 * @returns The base branch name (base.ref) the PR targets
 */
export async function getPrBaseBranch(
  page: Page,
  prNumber: number,
  buildUrl?: string
): Promise<string> {
  const baseUrl = buildUrl || getDashboardBaseUrl();

  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}`,
    }
  });

  if (!response.ok()) {
    throw new Error(`Failed to get PR ${prNumber}: ${response.status()}`);
  }

  const prData = await response.json();
  return prData.base.ref;
}

/**
 * Gets the diff/comparison between two branches
 * @param page The Playwright page object
 * @param baseBranch The base branch name
 * @param headBranch The head branch name
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 * @returns The comparison data from GitHub
 */
export async function compareBranches(
  page: Page,
  baseBranch: string,
  headBranch: string,
  buildUrl?: string
): Promise<any> {
  const baseUrl = buildUrl || getDashboardBaseUrl();
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/compare/${baseBranch}...${headBranch}`,
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to compare branches ${baseBranch}...${headBranch}: ${response.status()}`);
  }
  
  return await response.json();
}
