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

const SEEDS_DIR = path.join(__dirname, 'seeds');

async function getSeedFiles(): Promise<string[]> {
  const files = fs.readdirSync(SEEDS_DIR);
  return files
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function runSeed(filename: string): Promise<void> {
  const filepath = path.join(SEEDS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');

  try {
    await pool.query(sql);
    console.log(`✅ Applied seed: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to apply seed ${filename}:`, error);
    throw error;
  }
}

async function seed(): Promise<void> {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Get list of seed files
    const files = await getSeedFiles();
    console.log(`📁 Seed files found: ${files.length}\n`);

    if (files.length === 0) {
      console.log('No seed files found.');
      return;
    }

    // Run each seed file
    for (const file of files) {
      await runSeed(file);
    }

    console.log('\n✅ All seeds completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeds
seed();
