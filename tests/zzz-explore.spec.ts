import { test, expect } from "./fixtures";

test("explore cases endpoint", async ({ page }) => {
  await page.goto("/");
  const dbId = 103738;
  const c = await page.request.get(`/api/v2/test-runs/${dbId}/cases?per_page=200`);
  console.log("cases status", c.status());
  const body = await c.json();
  console.log("pagination", JSON.stringify(body.pagination));
  console.log("cases", JSON.stringify(body.data.map((d: any) => ({ pw: d.pw_test_id, status: d.status, nesting: d.nesting }))));
});
