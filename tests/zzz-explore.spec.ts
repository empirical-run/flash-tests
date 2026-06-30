import { test, expect } from "./fixtures";
import { getApiBaseUrl } from "./pages/urls";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";

test("explore run ids and status", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  const headers = await getApiWorkerAuthHeaders(page);
  const runId = 103738;

  const getRun = await page.request.get(`/api/test-runs/${runId}?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}`);
  const body = await getRun.json();
  const tr = body.data.test_run.testRun ?? body.data.test_run;
  console.log("testRun keys", Object.keys(tr));
  console.log("testRun id-ish", JSON.stringify(Object.fromEntries(Object.entries(tr).filter(([k]) => /id|uuid|sha|shard|external/i.test(k)))));
  console.log("test_case_ids field?", JSON.stringify((tr as any).test_case_ids));

  // try status with candidate identifiers
  const candidates: Array<[string, string]> = [
    ["dbid", String(runId)],
  ];
  for (const k of ["uuid", "external_id", "run_id", "test_run_head_sha", "commit"]) {
    if ((tr as any)[k]) candidates.push([k, String((tr as any)[k])]);
  }
  for (const [label, idval] of candidates) {
    for (const [b, base] of [["apiworker", getApiBaseUrl()], ["dash", ""]] as Array<[string,string]>) {
      const s = await page.request.get(`${base}/api/test-runs/${idval}/status`, { headers });
      console.log(`STATUS [${label}/${b}] ${idval}`, s.status(), (await s.text()).slice(0, 200));
    }
  }
});
