import { test, expect } from './fixtures';

test.describe('KV Store', () => {
  const KEY_NAME = 'name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('set value for key name and retrieve it', async ({ page, kv }) => {
    // First: Set a value for key "name" with 26 hours expiry
    await kv.set(KEY_NAME, 'test-value', EXPIRY_26_HOURS);

    // Second: Get the value
    const value = await kv.get<string>(KEY_NAME);

    // Third: Assert it is truthy
    expect(value).toBeTruthy();
    expect(value).toBe('test-value');

    // Fourth: Set it again with same expiry
    await kv.set(KEY_NAME, 'updated-test-value', EXPIRY_26_HOURS);

    // Verify the updated value
    const updatedValue = await kv.get<string>(KEY_NAME);
    expect(updatedValue).toBe('updated-test-value');
  });
});
