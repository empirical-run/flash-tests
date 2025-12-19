import { test, expect } from './fixtures';

test.describe('Postgres Database', () => {
  const DB_NAME_KEY = 'postgres-test-db-name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('create database, insert rows, query and cleanup', async ({ page, kv, postgres }) => {
    // Given we have a daily test run, we can assume the db is re-created every 24 hours.
    // The 26-hour expiry ensures the db name persists between daily runs.
    
    // Get the existing database name from KV
    const existingDbName = await kv.get<string>(DB_NAME_KEY);

    if (existingDbName) {
      // Get existing database (will be cached on subsequent runs)
      const { connectionUri } = await postgres.get(existingDbName);

      // Query existing data from previous run
      const existingUsers = await postgres.query<{ id: number; name: string }>(
        connectionUri,
        'SELECT * FROM users',
      );
      
      // Assert we got 2 rows from previous run
      expect(existingUsers.length).toBe(2);
      console.log('Queried existing users:', existingUsers);
    } else {
      console.log('No existing database found - this is the first run');
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
    console.log('Successfully inserted and verified users:', users);
  });
});
