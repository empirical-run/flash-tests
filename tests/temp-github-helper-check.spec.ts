import { test, expect } from "@playwright/test";
import { getMostRecentOpenPullRequest } from "./pages/github";

test("temp: github proxy helper works after refactor", async ({ page }) => {
  // Read-only call that exercises the refactored githubProxyRequest path.
  const pr = await getMostRecentOpenPullRequest(page);
  // Either there is an open PR (with a number) or none — both are valid; we just
  // assert the call completed without throwing on a non-ok proxy response.
  if (pr) {
    expect(typeof pr.number).toBe("number");
  }
  expect(true).toBe(true);
});
