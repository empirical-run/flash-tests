import { test, expect } from "./fixtures";
import { generateUniqueBranchName } from "./pages/branch-name";
import { deleteBranch } from "./pages/github";
import {
  triggerRunWithTestCaseIds,
  waitForRunEnded,
  getExecutedTestCaseIds,
  getStatusTestCaseIds,
  getRunDetail,
} from "./pages/test-case-ids";

// Explore: what happens with various invalid ids?
const cases: Array<[string, string[]]> = [
  ["only-nonexistent-wellformed", ["0000000000000000dead-0000000000000000beef"]],
  ["only-malformed", ["not-a-real-id"]],
  ["empty-string-id", [""]],
];

for (const [label, ids] of cases) {
  test(`invalid-id explore: ${label}`, async ({ page }) => {
    test.setTimeout(360000);
    await page.goto("/");
    const branch = generateUniqueBranchName(`explore-${label}`);
    let triggerStatus = "n/a";
    let triggerBody = "";
    const resp = await page.request.put("/api/test-runs", {
      headers: { "Content-Type": "application/json" },
      data: {
        project_id: Number(process.env.LOREM_IPSUM_PROJECT_ID),
        environment: "staging",
        build: { url: "https://lorem-ipsum-app-env-staging-empirical.vercel.app/", commit: "a1b2c3d4e5f6", branch },
        test_case_ids: ids,
      },
      timeout: 60000,
    });
    triggerStatus = String(resp.status());
    triggerBody = (await resp.text()).slice(0, 400);
    console.log(`\n[${label}] trigger HTTP ${triggerStatus}: ${triggerBody}`);
    if (!resp.ok()) {
      await deleteBranch(page, branch);
      return;
    }
    const dbId = (await resp.json()).data.test_run.id;
    const detail = await waitForRunEnded(page, dbId);
    const executed = await getExecutedTestCaseIds(page, dbId);
    const statusIds = await getStatusTestCaseIds(page, detail.run_id);
    console.log(`[${label}] ended state=${detail.state} total_count=${detail.total_count}`);
    console.log(`[${label}] executed=${JSON.stringify(executed)}`);
    console.log(`[${label}] status.test_case_ids=${JSON.stringify(statusIds)}`);
    await deleteBranch(page, branch);
  });
}
