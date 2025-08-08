
import { test as base } from "@playwright/test";
import { baseTestFixture } from "@empiricalrun/playwright-utils/test";

type TestFixtures = {
  sessionTracker: SessionTracker;
  trackCurrentSession: (page: any) => void;
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

export const test = baseTestFixture(base).extend<TestFixtures>({
  sessionTracker: async ({}, use) => {
    const tracker = new SessionTracker();
    await use(tracker);
  }
});

// Add afterEach hook to close sessions
test.afterEach(async ({ page, sessionTracker }) => {
  const sessionIds = sessionTracker.getSessionIds();
  
  for (const sessionId of sessionIds) {
    try {
      // Close the session using the API endpoint
      await page.request.post(`/api/sessions/${sessionId}/close`, {
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
