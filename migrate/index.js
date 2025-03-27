const { Client } = require('pg');
import MigrateRunner from './migrateRunner';
import ORM from '../utils/orm';

// Connect to PostgreSQL
const client = new ORM({
  user: 'mody',
  host: 'localhost',
  database: 'nodeorm',
  password: 'mody',
  port: 5432,
});

async function run() {
  try {
    await client.connect();
    const migrateRunner = new MigrateRunner(client);

    await migrateRunner.init(); // Ensure migration table exists

    if (process.argv[2] === 'up') {
      await migrateRunner.runMigrations();
    } else if (process.argv[2] === 'down') {
      await migrateRunner.rollbackAllMigrations();
    } else {
      console.log('Invalid command. Use "up" to migrate or "down" to rollback.');
    }
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    await client.end();
  }
}

run();
