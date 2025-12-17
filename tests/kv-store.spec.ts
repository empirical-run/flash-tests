import { test, expect } from './fixtures';

test.describe('KV Store', () => {
  const KEY_NAME = 'name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('set value for key name and retrieve it', async ({ page, kv }) => {
    // Given we have a daily test run, we can assume the key is re-set every 24 hours.
    // The 26-hour expiry ensures the key persists between daily runs.
    
    // First: Get the value
    const value = await kv.get<string>(KEY_NAME);

    // Second: Assert it is truthy
    expect(value).toBeTruthy();

    // Third: Set it again with 26 hours expiry
    await kv.set(KEY_NAME, 'updated-test-value', EXPIRY_26_HOURS);

    // Verify the updated value
    const updatedValue = await kv.get<string>(KEY_NAME);
    expect(updatedValue).toBe('updated-test-value');
  });
});
