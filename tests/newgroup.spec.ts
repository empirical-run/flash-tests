import { test } from "./fixtures";

test("test multipart", async ({ page }) => {
  await page.goto("https://www.google.com");

  await page.getByLabel("Search", { exact: true }).fill("airbnb");
});
