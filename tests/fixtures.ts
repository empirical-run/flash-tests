import { test as base, expect as baseExpect } from "@playwright/test";
import { baseTestFixture, extendExpect } from "@empiricalrun/playwright-utils/test";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { getBashToolCall, sendMessage, waitForAgentIdle, waitForAgentToFinish } from "./pages/sessions";
import { getApiBaseUrl } from "./pages/urls";

type RemoteBranch = {
  repository: string;
  branchName: string;
};

type TestFixtures = {
  sessionTracker: SessionTracker;
  issueTracker: IssueTracker;
  remoteBranchTracker: RemoteBranchTracker;
  trackCurrentSession: (page: any) => void;
  trackCurrentIssue: (page: any) => void;
  trackRemoteBranch: (repository: string, branchName: string) => void;
  applySelectedProject: void;
};

type TestOptions = {
  /**
   * Project slug stored in the dashboard's selected-project cookie for this test.
   * Override with test.use({ selectedProjectSlug: "..." }) for another project.
   */
  selectedProjectSlug: string;
};

export const DEFAULT_PROJECT_SLUG = "lorem-ipsum";

class SessionTracker {
  private sessionIds: string[] = [];
  
  addSession(sessionId: string) {
    if (sessionId && !this.sessionIds.includes(sessionId)) {
      this.sessionIds.push(sessionId);
    }
  }
  
  getSessionIds(): string[] {
    return [...this.sessionIds];
  }
  
  clear() {
    this.sessionIds = [];
  }
}

class IssueTracker {
  private issueIds: string[] = [];
  
  addIssue(issueId: string) {
    if (issueId && !this.issueIds.includes(issueId)) {
      this.issueIds.push(issueId);
    }
  }
  
  getIssueIds(): string[] {
    return [...this.issueIds];
  }
  
  clear() {
    this.issueIds = [];
  }
}

class RemoteBranchTracker {
  private branches: RemoteBranch[] = [];

  addBranch(repository: string, branchName: string) {
    if (repository && branchName && !this.branches.some(branch =>
      branch.repository === repository && branch.branchName === branchName
    )) {
      this.branches.push({ repository, branchName });
    }
  }

  getBranches(): RemoteBranch[] {
    return [...this.branches];
  }

  clear() {
    this.branches = [];
  }
}

export const test = baseTestFixture(base).extend<TestFixtures & TestOptions>({
  selectedProjectSlug: [DEFAULT_PROJECT_SLUG, { option: true }],

  // Make project selection deterministic in every test context instead of
  // inheriting whichever project happened to be captured during authentication.
  applySelectedProject: [
    async ({ context, baseURL, selectedProjectSlug }, use) => {
      if (!baseURL) {
        throw new Error(
          "baseURL is required to set the selected project explicitly",
        );
      }

      await context.addCookies([
        {
          name: "selected_project_slug",
          value: selectedProjectSlug,
          url: baseURL,
        },
      ]);
      await use();
    },
    { auto: true },
  ],

  sessionTracker: async ({}, use) => {
    const tracker = new SessionTracker();
    await use(tracker);
  },
  
  issueTracker: async ({}, use) => {
    const tracker = new IssueTracker();
    await use(tracker);
  },

  remoteBranchTracker: async ({}, use) => {
    const tracker = new RemoteBranchTracker();
    await use(tracker);
  },
  
  trackCurrentSession: async ({ sessionTracker }, use) => {
    const trackFunction = (page: any) => {
      const currentUrl = page.url();
      // Use regex to extract session ID directly, more robust than string contains check
      const match = currentUrl.match(/\/sessions\/([^?&#\/]+)/);
      const sessionId = match ? match[1] : null;
      if (sessionId && sessionId !== 'sessions') {
        sessionTracker.addSession(sessionId);
      }
    };
    await use(trackFunction);
  },
  
  trackCurrentIssue: async ({ issueTracker }, use) => {
    const trackFunction = (page: any) => {
      const currentUrl = page.url();
      // Extract issue ID from URL parameter (e.g., /issues?issueId=123)
      const urlObj = new URL(currentUrl);
      const issueId = urlObj.searchParams.get('issueId');
      if (issueId) {
        issueTracker.addIssue(issueId);
      }
    };
    await use(trackFunction);
  },

  trackRemoteBranch: async ({ remoteBranchTracker }, use) => {
    await use((repository: string, branchName: string) => {
      remoteBranchTracker.addBranch(repository, branchName);
    });
  }
});

// Add afterEach hook to close sessions and delete issues and remote branches
test.afterEach(async ({ page, sessionTracker, issueTracker, remoteBranchTracker }) => {
  const sessionIds = sessionTracker.getSessionIds();
  const issueIds = issueTracker.getIssueIds();
  const remoteBranches = remoteBranchTracker.getBranches();
  const remoteBranchCleanupErrors: Error[] = [];
  
  let apiHeaders: Record<string, string> | undefined;
  if (sessionIds.length > 0 || issueIds.length > 0) {
    try {
      // Dashboard cookies are not forwarded to the separate API origin, so direct
      // cleanup calls require the session Bearer token and project id explicitly.
      apiHeaders = await getApiWorkerAuthHeaders(page);
    } catch (error) {
      // Cleanup must not change the result of the test itself.
      console.warn("Failed to authenticate cleanup requests:", error);
    }
  }

  // Delete temporary branches from the app repo before closing their sessions.
  // The session sandbox has the git credentials required to push and delete them;
  // the dashboard GitHub proxy may only have read access to that repository.
  for (const { repository, branchName } of remoteBranches) {
    try {
      if (!page.url().includes('/sessions/')) {
        throw new Error('the test page is no longer on its session');
      }

      // Commit review is a modal dialog in the new UI; dismiss it before sending
      // the cleanup instruction to the agent (also when a diff assertion failed).
      const commitReview = page.getByRole('dialog', { name: /^Commit [a-f0-9]{7}$/i });
      if (await commitReview.isVisible()) {
        await commitReview.getByRole('button', { name: 'Close' }).click();
      }

      const verifiedMarker = `BRANCH_CLEANUP_VERIFIED:${branchName}`;
      await waitForAgentIdle(page, 120000);
      await sendMessage(
        page,
        `Run exactly one bash command to clean up the temporary ${repository} branch, then do nothing else: \`git push origin --delete "${branchName}" && test -z "$(git ls-remote --heads origin "refs/heads/${branchName}")" && printf '${verifiedMarker}\\n'\`.`,
      );
      await waitForAgentToFinish(page, 120000);

      // The marker is emitted only after both deletion and remote-ref verification
      // succeed. Assert the bash output rather than trusting the agent's summary.
      // The visible tool label truncates long commands before the branch suffix,
      // so identify the cleanup by its stable command prefix and verify the full
      // branch-specific marker in the untruncated output.
      const cleanupToolCall = getBashToolCall(page, /git push origin --delete/, 'used').last();
      await baseExpect(cleanupToolCall).toBeVisible();
      await cleanupToolCall.click();
      const cleanupOutput = page.getByTestId('inline-tool-details').last();
      await baseExpect(cleanupOutput).toBeVisible();
      await baseExpect(cleanupOutput).toContainText(verifiedMarker);
    } catch (error) {
      const cleanupError = error instanceof Error ? error : new Error(String(error));
      remoteBranchCleanupErrors.push(cleanupError);
      console.warn(`Failed to delete ${repository} branch ${branchName}:`, cleanupError);
    }
  }

  // Close sessions
  for (const sessionId of apiHeaders ? sessionIds : []) {
    try {
      const response = await page.request.post(
        `${getApiBaseUrl()}/api/chat-sessions/${sessionId}/close`,
        { headers: apiHeaders },
      );
      if (!response.ok()) {
        throw new Error(
          `API returned ${response.status()}: ${await response.text()}`,
        );
      }
    } catch (error) {
      // Log error but don't fail the test
      console.warn(`Failed to close session ${sessionId}:`, error);
    }
  }
  
  // Delete issues
  for (const issueId of apiHeaders ? issueIds : []) {
    try {
      const response = await page.request.delete(
        `${getApiBaseUrl()}/api/issues/${issueId}`,
        { headers: apiHeaders },
      );
      if (!response.ok()) {
        throw new Error(
          `API returned ${response.status()}: ${await response.text()}`,
        );
      }
    } catch (error) {
      // Log error but don't fail the test
      console.warn(`Failed to delete issue ${issueId}:`, error);
    }
  }
  
  // Clear the trackers for next test
  sessionTracker.clear();
  issueTracker.clear();
  remoteBranchTracker.clear();

  // Surface hygiene regressions after the remaining teardown has completed, so a
  // failed branch deletion cannot silently return the suite to accumulating refs.
  if (remoteBranchCleanupErrors.length > 0) {
    throw new Error(
      `Remote branch cleanup failed:\n${remoteBranchCleanupErrors.map(error => error.message).join('\n')}`,
    );
  }
});

export const expect = extendExpect(baseExpect);
