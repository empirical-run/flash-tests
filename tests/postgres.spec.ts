import { test, expect } from './fixtures';

test.describe('Postgres Database', () => {
  const DB_NAME = 'postgres-test-db';
  const DB_NAME_KEY = 'postgres-test-db-name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('create database, insert rows, query and cleanup', async ({ page, kv, postgres }) => {
    // Given we have a daily test run, we can assume the db is re-created every 24 hours.
    // The 26-hour expiry ensures the db name persists between daily runs.
    
    // Get or create database with constant name
    const { connectionUri } = await postgres.get(DB_NAME);

    // Query existing data (will return empty array on first run, 2 rows on subsequent runs)
    const existingUsers = await postgres.query<{ id: number; name: string }>(
      connectionUri,
      'SELECT * FROM users',
    );
    console.log('Queried existing users:', existingUsers);

    // Delete the database
    await postgres.delete(DB_NAME);

    // Create a new database
    const { connectionUri: newConnectionUri } = await postgres.get(DB_NAME);

    // Store the database name in KV with 26 hours expiry
    await kv.set(DB_NAME_KEY, DB_NAME, EXPIRY_26_HOURS);

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
    console.log('Successfully inserted and verified users:', users);
  });
});
