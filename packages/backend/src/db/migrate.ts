import { config } from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
const rootDir = path.resolve(__dirname, '../../../../');
config({ path: path.join(rootDir, '.env') });

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface Migration {
  id: number;
  name: string;
  applied_at: Date;
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<string[]> {
  const result = await pool.query<Migration>(
    'SELECT name FROM schema_migrations ORDER BY id'
  );
  return result.rows.map((row) => row.name);
}

async function getMigrationFiles(): Promise<string[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  return files
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function runMigration(filename: string): Promise<void> {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Execute the migration SQL
    await client.query(sql);

    // Record the migration
    await client.query(
      'INSERT INTO schema_migrations (name) VALUES ($1)',
      [filename]
    );

    await client.query('COMMIT');
    console.log(`✅ Applied migration: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function migrate(): Promise<void> {
  console.log('🔄 Starting database migration...\n');

  try {
    // Ensure migrations tracking table exists
    await ensureMigrationsTable();

    // Get list of applied migrations
    const applied = await getAppliedMigrations();
    console.log(`📋 Applied migrations: ${applied.length}`);

    // Get list of migration files
    const files = await getMigrationFiles();
    console.log(`📁 Migration files found: ${files.length}\n`);

    // Find pending migrations
    const pending = files.filter((file) => !applied.includes(file));

    if (pending.length === 0) {
      console.log('✨ Database is up to date. No migrations to run.');
      return;
    }

    console.log(`🚀 Running ${pending.length} pending migration(s)...\n`);

    // Run each pending migration
    for (const file of pending) {
      await runMigration(file);
    }

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
migrate();
