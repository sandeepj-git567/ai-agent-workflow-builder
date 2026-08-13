import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[Migrate] No DATABASE_URL provided. Skipping PostgreSQL migration.');
    return;
  }

  console.log('[Migrate] Connecting to PostgreSQL at:', databaseUrl.split('@')[1] || 'localhost');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    console.log('[Migrate] Connected successfully.');

    const migrationsDir = path.join(process.cwd(), 'hasura', 'migrations', 'default');
    if (!fs.existsSync(migrationsDir)) {
      console.warn('[Migrate] No migrations directory found at', migrationsDir);
      client.release();
      return;
    }

    const folders = fs.readdirSync(migrationsDir).sort();
    for (const folder of folders) {
      const upSqlPath = path.join(migrationsDir, folder, 'up.sql');
      if (fs.existsSync(upSqlPath)) {
        console.log(`[Migrate] Running migration: ${folder}/up.sql`);
        const sql = fs.readFileSync(upSqlPath, 'utf8');
        await client.query(sql);
        console.log(`[Migrate] Applied: ${folder}`);
      }
    }

    client.release();
    console.log('[Migrate] All migrations completed successfully.');
  } catch (err) {
    console.error('[Migrate] Migration failed:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

export { runMigrations };
