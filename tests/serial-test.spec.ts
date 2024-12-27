import { test } from "./fixtures";

test.describe.serial("Serial test group", () => {
  test("random value generator", async ({ page, userContext }) => {
    const randomValue = Math.random();
    console.log(`Random value: ${randomValue}`);

    await page.fill('input[type="email"]', userContext.email);
    await page.fill('input[type="password"]', userContext.password);

    if (randomValue > 0.4) {
      throw new Error("Flaky error triggered because random value > 0.4");
    }
  });

  test("dependent test", async ({ page, userContext }) => {
    await page.fill('input[type="email"]', userContext.email);
    await page.fill('input[type="password"]', userContext.password);
  });
});
