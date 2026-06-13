import { test, expect } from './fixtures';

test.describe('KV Store', () => {
  const KEY_NAME = 'name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('set value for key name and retrieve it', async ({ page, kv }) => {
    // Seed the value first so this test does not depend on state from a previous run.
    await kv.set(KEY_NAME, 'seeded-test-value', EXPIRY_26_HOURS);

    // First: Get the seeded value
    const value = await kv.get<string>(KEY_NAME);

    // Second: Assert the seeded value is available
    expect(value).toBe('seeded-test-value');

    // Third: Set it again with 26 hours expiry
    await kv.set(KEY_NAME, 'updated-test-value', EXPIRY_26_HOURS);

    // Verify the updated value
    const updatedValue = await kv.get<string>(KEY_NAME);
    expect(updatedValue).toBe('updated-test-value');
  });
});
