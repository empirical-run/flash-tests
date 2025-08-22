
import { test as base } from "@playwright/test";
import { baseTestFixture } from "@empiricalrun/playwright-utils/test";

type TestFixtures = {
  sessionTracker: SessionTracker;
  issueTracker: IssueTracker;
  trackCurrentSession: (page: any) => void;
  trackCurrentIssue: (page: any) => void;
};

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

export const test = baseTestFixture(base).extend<TestFixtures>({
  sessionTracker: async ({}, use) => {
    const tracker = new SessionTracker();
    await use(tracker);
  },
  
  issueTracker: async ({}, use) => {
    const tracker = new IssueTracker();
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
  }
});

// Add afterEach hook to close sessions
test.afterEach(async ({ page, sessionTracker }) => {
  const sessionIds = sessionTracker.getSessionIds();
  
  for (const sessionId of sessionIds) {
    try {
      // Close the session using the correct API endpoint
      await page.request.post(`/api/chat-sessions/${sessionId}/close`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      // Log error but don't fail the test
      console.warn(`Failed to close session ${sessionId}:`, error);
    }
  }
  
  // Clear the session tracker for next test
  sessionTracker.clear();
});

export const expect = test.expect;
