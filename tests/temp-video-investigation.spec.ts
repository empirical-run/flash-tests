import { test, expect } from "./fixtures";

test('investigate video analysis status in triage session', async ({ page }) => {
  await page.goto('/');
  // TODO(agent on page): Navigate to sessions page, create a triage session with video analysis prompt, check current status and results
});