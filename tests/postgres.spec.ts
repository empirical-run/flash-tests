import { test, expect } from './fixtures';

test.describe('Postgres Database', () => {
  const DB_NAME_KEY = 'postgres-test-db-name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('create database and insert rows', async ({ page, kv, postgres }) => {
    // Get the existing database name from KV
    const existingDbName = await kv.get<string>(DB_NAME_KEY);

    // Delete the existing database if it exists
    if (existingDbName) {
      await postgres.delete(existingDbName);
    }

    // Create a new database with unique name
    const newDbName = `test-db-${Date.now()}`;
    const { connectionUri: newConnectionUri } = await postgres.get(newDbName);

    // Store the new database name in KV with 26 hours expiry
    await kv.set(DB_NAME_KEY, newDbName, EXPIRY_26_HOURS);

    // Create users table and insert 2 rows
    await postgres.execute(
      newConnectionUri,
      `
      CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
      INSERT INTO users (name) VALUES ('Alice'), ('Bob');
      `,
    );

    // Verify the 2 rows were inserted
    const users = await postgres.query<{ id: number; name: string }>(
      newConnectionUri,
      'SELECT * FROM users',
    );
    
    expect(users.length).toBe(2);
    expect(users[0].name).toBe('Alice');
    expect(users[1].name).toBe('Bob');
    console.log('Successfully created database and inserted users:', users);
  });

  test('verify database rows', async ({ page, kv, postgres }) => {
    // Get the existing database name from KV
    const existingDbName = await kv.get<string>(DB_NAME_KEY);
    expect(existingDbName).toBeTruthy();

    // Get existing database
    const { connectionUri } = await postgres.get(existingDbName);

    // Query existing data
    const existingUsers = await postgres.query<{ id: number; name: string }>(
      connectionUri,
      'SELECT * FROM users',
    );
    
    // Assert we got 2 rows
    expect(existingUsers.length).toBe(2);
    expect(existingUsers[0].name).toBe('Alice');
    expect(existingUsers[1].name).toBe('Bob');
    console.log('Successfully verified existing users:', existingUsers);
  });
});
