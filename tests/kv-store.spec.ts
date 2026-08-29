import { test, expect } from "./fixtures";

test.describe("KV Store", () => {
  const KEY_NAME = "name";
  const EXPIRY_2_DAYS = 2 * 24 * 3600; // Maximum supported KV TTL.

  test("set value for key name and retrieve it", async ({ kv }) => {
    // This test intentionally verifies cross-run persistence: the value should
    // have been written by the previous run and still be available.
    const value = await kv.get<string>(KEY_NAME);
    expect(value).toBeTruthy();

    // Refresh using the maximum TTL to tolerate a missed daily run.
    await kv.set(KEY_NAME, "updated-test-value", EXPIRY_2_DAYS);

    // Verify the value is readable in the current run after refresh.
    const updatedValue = await kv.get<string>(KEY_NAME);
    expect(updatedValue).toBe("updated-test-value");
  });
});
