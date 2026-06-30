import { test, expect } from "./fixtures";

test("explore status full + summary", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  const dbId = 103738;
  const getRun = await page.request.get(`/api/test-runs/${dbId}?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}`);
  const body = await getRun.json();
  const tr = body.data.test_run.testRun;
  const runId = tr.run_id;
  console.log("state", tr.state, "total_count", tr.total_count);
  console.log("flattenedSummaryDetails", JSON.stringify(body.data.test_run.flattenedSummaryDetails?.map((d: any) => ({ name: d.name, pw: d.pw_test_id, status: d.status }))));

  // status with cookies only (no headers)
  const s = await page.request.get(`/api/test-runs/${runId}/status`);
  console.log("STATUS cookies-only", s.status());
  console.log("STATUS body", JSON.stringify(await s.json(), null, 2));
});
