import { test, expect } from "./fixtures";
import { getApiBaseUrl } from "./pages/urls";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";

test("explore trigger with ids and status", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  const headers = await getApiWorkerAuthHeaders(page);

  const tc = await page.request.get(`${getApiBaseUrl()}/api/v2/test-cases?per_page=100`, { headers });
  const tcBody = await tc.json();
  const cases = tcBody.data.test_cases;
  const loginId = cases.find((c: any) => c.name === "click login button and input dummy email").id;
  const searchId = cases.find((c: any) => c.name === "search for auth shows only 1 card").id;
  const ids = [loginId, searchId];
  console.log("selected ids", ids);

  const trigger = await page.request.put('/api/test-runs', {
    headers: { 'Content-Type': 'application/json' },
    data: {
      project_id: Number(process.env.LOREM_IPSUM_PROJECT_ID),
      environment: 'staging',
      build: {
        url: 'https://lorem-ipsum-app-env-staging-empirical.vercel.app/',
        commit: 'a1b2c3d4e5f6',
        branch: 'explore-test-case-ids',
      },
      test_case_ids: ids,
    },
    timeout: 60000,
  });
  console.log("trigger status", trigger.status());
  const triggerBody = await trigger.json();
  const runId = triggerBody.data.test_run.id;
  console.log("runId", runId);

  // poll status endpoint variants immediately
  for (const [label, url, opts] of [
    ["apiworker+headers", `${getApiBaseUrl()}/api/test-runs/${runId}/status`, { headers }],
    ["dashboard+cookies", `/api/test-runs/${runId}/status`, {}],
  ] as Array<[string, string, any]>) {
    const s = await page.request.get(url, opts);
    console.log(`STATUS [${label}]`, s.status(), (await s.text()).slice(0, 600));
  }
});
