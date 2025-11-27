import { Page } from '@playwright/test';

/**
 * Gets the SHA of a branch from GitHub
 * @param page The Playwright page object
 * @param branchName The name of the branch
 * @param buildUrl The build URL (defaults to https://dash.empirical.run)
 * @returns The SHA of the branch
 */
export async function getBranchSha(
  page: Page,
  branchName: string,
  buildUrl?: string
): Promise<string> {
  const baseUrl = buildUrl || process.env.BUILD_URL || "https://dash.empirical.run";
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/branches/${branchName}`
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
 * @param buildUrl The build URL (defaults to https://dash.empirical.run)
 */
export async function createBranch(
  page: Page,
  branchName: string,
  fromSha: string,
  buildUrl?: string
): Promise<void> {
  const baseUrl = buildUrl || process.env.BUILD_URL || "https://dash.empirical.run";
  
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
 * @param buildUrl The build URL (defaults to https://dash.empirical.run)
 */
export async function deleteBranch(
  page: Page,
  branchName: string,
  buildUrl?: string
): Promise<void> {
  const baseUrl = buildUrl || process.env.BUILD_URL || "https://dash.empirical.run";
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'DELETE',
      url: `/repos/empirical-run/lorem-ipsum-tests/git/refs/heads/${branchName}`
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to delete branch ${branchName}: ${response.status()}`);
  }
}

/**
 * Creates a pull request on GitHub
 * @param page The Playwright page object
 * @param title The PR title
 * @param head The head branch name
 * @param base The base branch name
 * @param body The PR body/description
 * @param buildUrl The build URL (defaults to https://dash.empirical.run)
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
  const baseUrl = buildUrl || process.env.BUILD_URL || "https://dash.empirical.run";
  
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
 * Gets PR details from GitHub
 * @param page The Playwright page object
 * @param prNumber The PR number
 * @param buildUrl The build URL (defaults to https://dash.empirical.run)
 * @returns The PR data from GitHub
 */
export async function getPullRequest(
  page: Page,
  prNumber: number,
  buildUrl?: string
): Promise<any> {
  const baseUrl = buildUrl || process.env.BUILD_URL || "https://dash.empirical.run";
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}`
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
 * @param buildUrl The build URL (defaults to https://dash.empirical.run)
 * @returns The comparison data from GitHub
 */
export async function compareBranches(
  page: Page,
  baseBranch: string,
  headBranch: string,
  buildUrl?: string
): Promise<any> {
  const baseUrl = buildUrl || process.env.BUILD_URL || "https://dash.empirical.run";
  
  const response = await page.request.post(`${baseUrl}/api/github/proxy`, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      method: 'GET',
      url: `/repos/empirical-run/lorem-ipsum-tests/compare/${baseBranch}...${headBranch}`
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Failed to compare branches ${baseBranch}...${headBranch}: ${response.status()}`);
  }
  
  return await response.json();
}
