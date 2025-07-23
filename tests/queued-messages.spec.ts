import { test, expect } from "./fixtures";

test.describe("Queued Messages", () => {
  test("verify message queuing works when tool is running", async ({ page }) => {
    // Navigate to homepage
    await page.goto("/");
    
    // TODO(agent on page): Navigate to sessions, create a new session, send first message "list all files in tests dir" with Ctrl+Enter, verify "running..." appears, then send second message "also read the readme" with Ctrl+Shift+Enter and verify "message queued" appears
  });
});