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
 * Creates (or updates) a file on a branch via the GitHub contents API.
 * This produces a real commit on the branch so that a pull request opened from it
 * has a non-empty diff.
 *
 * @param page The Playwright page object
 * @param branchName The branch to commit the file to
 * @param filePath The path of the file in the repo (e.g. "tmp/foo.txt")
 * @param content The file content (plain text, will be base64 encoded)
 * @param message The commit message
 * @param buildUrl The build URL (defaults to the configured dashboard base URL)
 */
export async function createFileOnBranch(
  page: Page,
  branchName: string,
  filePath: string,
  content: string,
  message: string,
  buildUrl?: string
): Promise<void> {
  const baseUrl = buildUrl || getDashboardBaseUrl();

  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'PUT',
      url: `/repos/empirical-run/lorem-ipsum-tests/contents/${filePath}`,
      body: {
        message,
        content: Buffer.from(content).toString('base64'),
        branch: branchName
      }
    }
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to create file ${filePath} on ${branchName}: ${response.status()} - ${errorText}`);
  }
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
