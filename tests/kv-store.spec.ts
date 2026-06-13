import { test, expect } from "./fixtures";

test.describe("KV Store", () => {
  const KEY_NAME = "name";
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test("set value for key name and retrieve it", async ({ kv }) => {
    // This test intentionally verifies cross-run persistence: the value should
    // have been written by the previous scheduled run and still be available.
    const value = await kv.get<string>(KEY_NAME);
    expect(value).toBeTruthy();

    // Refresh the persisted value for the next scheduled run.
    await kv.set(KEY_NAME, "updated-test-value", EXPIRY_26_HOURS);

    // Verify the value is readable in the current run after refresh.
    const updatedValue = await kv.get<string>(KEY_NAME);
    expect(updatedValue).toBe("updated-test-value");
  });
});
