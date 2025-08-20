
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
  },
  
  trackCurrentSession: async ({ sessionTracker }, use) => {
    const trackFunction = (page: any) => {
      const currentUrl = page.url();
      console.log(`[DEBUG] Current URL: ${currentUrl}`);
      if (currentUrl.includes('/sessions/')) {
        // Use regex to properly extract session ID, handling query params, fragments, and trailing slashes
        const match = currentUrl.match(/\/sessions\/([^?&#\/]+)/);
        const sessionId = match ? match[1] : null;
        console.log(`[DEBUG] Extracted session ID: ${sessionId}`);
        if (sessionId && sessionId !== 'sessions') {
          sessionTracker.addSession(sessionId);
          console.log(`[DEBUG] Added session ID to tracker: ${sessionId}`);
        }
      } else {
        console.log(`[DEBUG] URL does not contain /sessions/`);
      }
    };
    await use(trackFunction);
  }
});

// Add afterEach hook to close sessions
test.afterEach(async ({ page, sessionTracker }) => {
  const sessionIds = sessionTracker.getSessionIds();
  console.log(`[DEBUG] AfterEach: Found ${sessionIds.length} session IDs to close:`, sessionIds);
  
  for (const sessionId of sessionIds) {
    try {
      console.log(`[DEBUG] Attempting to close session: ${sessionId}`);
      // Close the session using the API endpoint
      const response = await page.request.post(`/api/sessions/${sessionId}/close`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(`[DEBUG] Session ${sessionId} close response status: ${response.status()}`);
    } catch (error) {
      // Log error but don't fail the test
      console.warn(`Failed to close session ${sessionId}:`, error);
    }
  }
  
  // Clear the session tracker for next test
  sessionTracker.clear();
  console.log(`[DEBUG] AfterEach: Cleared session tracker`);
});

export const expect = test.expect;
