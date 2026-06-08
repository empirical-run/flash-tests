import { test, expect } from './fixtures';

test.describe('Postgres Database', () => {
  test.describe.configure({ mode: 'serial' });
  
  const DB_NAME_KEY = 'postgres-test-db-name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('verify database rows from previous run', async ({ page, kv, postgres }) => {
    // Get the existing database name from KV (saved by previous run)
    const existingDbName = await kv.get<string>(DB_NAME_KEY);
    
    // Skip if this is the first run (no data from previous run)
    if (!existingDbName) {
      test.skip();
      return;
    }

    // Get existing database
    const { connectionUri } = await postgres.get(existingDbName);

    const usersTable = await postgres.query<{ exists: boolean }>(
      connectionUri,
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')",
    );

    // Skip if a previous parallel run left KV pointing at a database before setup completed.
    if (!usersTable[0]?.exists) {
      test.skip(true, 'Previous run database does not contain the expected users table');
      return;
    }

    // Query existing data from previous run
    const existingUsers = await postgres.query<{ id: number; name: string }>(
      connectionUri,
      'SELECT * FROM users ORDER BY id',
    );
    
    // Assert we got 2 rows from previous run
    expect(existingUsers.length).toBe(2);
    expect(existingUsers[0].name).toBe('Alice');
    expect(existingUsers[1].name).toBe('Bob');
  });

  test('create database and insert rows for next run', async ({ page, kv, postgres }) => {
    // Get the existing database name from KV
    const existingDbName = await kv.get<string>(DB_NAME_KEY);

    // Delete the existing database if it exists. This happens only after the
    // verification test has already read it because the tests run serially.
    if (existingDbName) {
      await postgres.delete(existingDbName);
    }

    // Create a new database with unique name
    const newDbName = `test-db-${Date.now()}`;
    const { connectionUri: newConnectionUri } = await postgres.get(newDbName);

    // Create users table and insert 2 rows before exposing this database to the next run.
    await postgres.execute(
      newConnectionUri,
      `
      CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
      INSERT INTO users (name) VALUES ('Alice'), ('Bob');
      `,
    );

    const users = await postgres.query<{ id: number; name: string }>(
      newConnectionUri,
      'SELECT * FROM users ORDER BY id',
    );
    
    expect(users.length).toBe(2);
    expect(users[0].name).toBe('Alice');
    expect(users[1].name).toBe('Bob');

    // Store the new database name in KV with 26 hours expiry after setup succeeds.
    await kv.set(DB_NAME_KEY, newDbName, EXPIRY_26_HOURS);
  });
});
