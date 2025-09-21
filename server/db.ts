import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

if (!process.env.PGSSLMODE) {
  process.env.PGSSLMODE = "require";
}
if (!process.env.PGSSLREJECT_UNAUTHORIZED) {
  process.env.PGSSLREJECT_UNAUTHORIZED = "false";
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSLMODE === 'disable'
    ? undefined
    : { rejectUnauthorized: process.env.PGSSLREJECT_UNAUTHORIZED === 'true' }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool, { schema });
