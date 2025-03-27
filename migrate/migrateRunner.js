const fs = require('fs');
const path = require('path');
const { Client } = require('pg'); // Assuming you're using `pg` to interact with PostgreSQL

export default class MigrateRunner {
  constructor(db) {
    this.db = db;
    this.migrationsFolder = path.resolve(__dirname, 'migrations');
  }

  // Initialize the migrations table
  async init() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY
      );
    `;
    await this.db.query(createTableQuery);
  }

  // Get the list of migrations that have already been applied
  async getAppliedMigrations() {
    const result = await this.db.query('SELECT version FROM schema_migrations');
    return result.rows.map(row => row.version);
  }

  // Get the list of all migration files in the migrations folder
  async getAllMigrations() {
    const files = fs.readdirSync(this.migrationsFolder);
    return files.filter(file => file.endsWith('.js')).sort(); // Sort to ensure the correct order
  }

  // Execute a specific migration
  async executeMigration(migration) {
    const migrationModule = require(path.join(this.migrationsFolder, migration));
    const migrationInstance = new migrationModule(this.db);

    if (migrationInstance.change) {
      await migrationInstance.change();
    }
    await this.db.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [migration]
    );
    console.log(`Executed migration: ${migration}`);
  }

  // Run all pending migrations
  async runMigrations() {
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = await this.getAllMigrations();

    const pendingMigrations = allMigrations.filter(migration => !appliedMigrations.includes(migration));

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    if (pendingMigrations.length === 0) {
      console.log('All migrations are already up to date.');
    }
  }

  // Rollback a specific migration
  async rollbackMigration(migration) {
    const migrationModule = require(path.join(this.migrationsFolder, migration));
    const migrationInstance = new migrationModule(this.db);

    if (migrationInstance.down) {
      await migrationInstance.down();
    }
    await this.db.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [migration]
    );
    console.log(`Rolled back migration: ${migration}`);
  }

  // Rollback all migrations in reverse order
  async rollbackAllMigrations() {
    const appliedMigrations = await this.getAppliedMigrations();
    const reverseMigrations = appliedMigrations.reverse();

    for (const migration of reverseMigrations) {
      await this.rollbackMigration(migration);
    }

    if (reverseMigrations.length === 0) {
      console.log('No migrations to rollback.');
    }
  }
}