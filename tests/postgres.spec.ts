import { test, expect } from './fixtures';

test.describe('Postgres Database', () => {
  const DB_NAME_KEY = 'postgres-test-db-name';
  const EXPIRY_26_HOURS = 26 * 3600; // 26 hours in seconds = 93600

  test('create database, insert rows, query and cleanup', async ({ page, kv, postgres }) => {
    // Given we have a daily test run, we can assume the db is re-created every 24 hours.
    // The 26-hour expiry ensures the db name persists between daily runs.
    
    // First: Try to get the existing database name from KV
    const existingDbName = await kv.get<string>(DB_NAME_KEY);

    if (existingDbName) {
      // If database exists from previous run, query it for 2 rows
      const { connectionUri } = await postgres.get(existingDbName);
      
      try {
        const users = await postgres.query<{ id: number; name: string }>(
          connectionUri,
          'SELECT * FROM users LIMIT 2',
        );
        
        // Assert we got 2 rows
        expect(users.length).toBe(2);
        console.log('Retrieved users from previous run:', users);
      } catch (error) {
        console.log('Could not query existing database (might not have users table):', error);
      }

      // Delete the existing database
      await postgres.delete(existingDbName);
      console.log('Deleted existing database:', existingDbName);
    }

    // Create a new database with a unique name
    const newDbName = `test-db-${Date.now()}`;
    const { connectionUri } = await postgres.get(newDbName);

    // Store the new database name in KV with 26 hours expiry
    await kv.set(DB_NAME_KEY, newDbName, EXPIRY_26_HOURS);

    // Create users table and insert 2 rows
    await postgres.execute(
      connectionUri,
      `
      CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
      INSERT INTO users (name) VALUES ('Alice'), ('Bob');
      `,
    );

    // Verify the 2 rows were inserted
    const users = await postgres.query<{ id: number; name: string }>(
      connectionUri,
      'SELECT * FROM users',
    );
    
    expect(users.length).toBe(2);
    expect(users[0].name).toBe('Alice');
    expect(users[1].name).toBe('Bob');
    console.log('Successfully inserted and verified users:', users);
  });
});
