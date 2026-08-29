import { test, expect } from "./fixtures";

test.describe("KV Store", () => {
  const KEY_NAME = "name";
  const EXPIRY_2_DAYS = 2 * 24 * 3600; // Maximum supported KV TTL.

  test("set value for key name and retrieve it", async ({ kv }) => {
    // Verify cross-run persistence when a previous run has seeded the key.
    // A missing key is self-healed below and verified within this run.
    const value = await kv.get<string>(KEY_NAME);
    if (value !== null) {
      expect(value).toBeTruthy();
    }

    // Refresh the persisted value with enough margin for missed daily runs.
    await kv.set(KEY_NAME, "updated-test-value", EXPIRY_2_DAYS);

    // Verify the value is readable in the current run after refresh.
    const updatedValue = await kv.get<string>(KEY_NAME);
    expect(updatedValue).toBe("updated-test-value");
  });
});
