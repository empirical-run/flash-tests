import { test, expect } from "./fixtures";
import { getApiBaseUrl } from "./pages/urls";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";

test("explore cases endpoint", async ({ page }) => {
  await page.goto("/");
  const headers = await getApiWorkerAuthHeaders(page);
  const dbId = 103738;
  for (const [label, url, opts] of [
    ["apiworker+headers", `${getApiBaseUrl()}/api/v2/test-runs/${dbId}/cases?per_page=200`, { headers }],
    ["dash+headers", `/api/v2/test-runs/${dbId}/cases?per_page=200`, { headers }],
  ] as Array<[string, string, any]>) {
    const c = await page.request.get(url, opts);
    console.log(`cases [${label}]`, c.status());
    if (c.ok()) {
      const body = await c.json();
      console.log("pagination", JSON.stringify(body.pagination));
      console.log("cases", JSON.stringify(body.data.map((d: any) => ({ pw: d.pw_test_id, status: d.status, nesting: d.nesting }))));
    }
  }
});
