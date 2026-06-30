import { test } from "./fixtures";
import { getRunDetail, getExecutedTestCaseIds, getStatusTestCaseIds } from "./pages/test-case-ids";

test("check invalid-id run outcomes", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  for (const dbId of [103762, 103763]) {
    const detail = await getRunDetail(page, dbId);
    console.log(`\nrun ${dbId}: state=${detail.state} total_count=${detail.total_count} test_case_ids=${JSON.stringify(detail.test_case_ids)}`);
    const executed = await getExecutedTestCaseIds(page, dbId);
    console.log(`run ${dbId}: executed(${executed.length})=${JSON.stringify(executed)}`);
    const statusIds = await getStatusTestCaseIds(page, detail.run_id);
    console.log(`run ${dbId}: status.test_case_ids=${JSON.stringify(statusIds)}`);
  }
});
