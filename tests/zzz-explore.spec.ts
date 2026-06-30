import { test, expect } from "./fixtures";
import { getApiBaseUrl } from "./pages/urls";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";

test("explore test cases and status", async ({ page }) => {
  await page.goto("/");
  const headers = await getApiWorkerAuthHeaders(page);

  // list lorem-ipsum test cases via api worker
  const tc = await page.request.get(`${getApiBaseUrl()}/api/v2/test-cases?per_page=100`, { headers });
  console.log("TC status", tc.status());
  const tcBody = await tc.json();
  console.log("TC count", tcBody.data?.test_cases?.length);
  console.log("TC sample", JSON.stringify(tcBody.data?.test_cases?.slice(0, 6).map((t: any) => ({ id: t.id, name: t.name, file: t.file_path }))));

  // list a recent test run and hit status
  const runs = await page.request.get(`/api/test-runs?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}&per_page=3`);
  const runsBody = await runs.json();
  const runId = runsBody.data.test_runs.items[0].id;
  console.log("runId", runId);

  for (const base of [getApiBaseUrl(), ""]) {
    const s = await page.request.get(`${base}/api/test-runs/${runId}/status`, { headers });
    console.log(`STATUS via [${base || "dashboard"}]`, s.status(), (await s.text()).slice(0, 600));
  }
});
