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

  const getRun = await page.request.get(`/api/test-runs/${runId}?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}`);
  const getRunBody = await getRun.json();
  console.log("GET run project", getRunBody.data?.test_run?.project?.slug, getRunBody.data?.test_run?.project?.id);

  const variants: Array<[string, string, any]> = [
    ["apiworker+headers", `${getApiBaseUrl()}/api/test-runs/${runId}/status`, { headers }],
    ["dashboard+headers", `/api/test-runs/${runId}/status`, { headers }],
    ["dashboard+cookies+pid", `/api/test-runs/${runId}/status?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}`, {}],
    ["dashboard+cookies", `/api/test-runs/${runId}/status`, {}],
  ];
  for (const [label, url, opts] of variants) {
    const s = await page.request.get(url, opts);
    console.log(`STATUS [${label}]`, s.status(), (await s.text()).slice(0, 400));
  }
});
