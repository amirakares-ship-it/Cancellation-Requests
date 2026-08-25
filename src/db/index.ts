import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads and serverless invocations
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool.
export const createPool = (): Pool | null => {
  if (global._postgresPool) {
    return global._postgresPool;
  }

  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.SQL_URL;

  if (connectionString) {
    try {
      const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      global._postgresPool = new Pool({
        connectionString,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 2 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } catch (poolErr) {
      console.error('Failed to initialize pg.Pool with connectionString:', poolErr);
      return null;
    }
  } else if (process.env.SQL_HOST || process.env.POSTGRES_HOST) {
    try {
      const host = process.env.SQL_HOST || process.env.POSTGRES_HOST;
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';
      const useSsl = process.env.SQL_SSL === 'true' || process.env.POSTGRES_SSL === 'true' || (!isLocalhost && !process.env.SQL_HOST);
      
      global._postgresPool = new Pool({
        host,
        user: process.env.SQL_USER || process.env.POSTGRES_USER,
        password: process.env.SQL_PASSWORD || process.env.POSTGRES_PASSWORD,
        database: process.env.SQL_DB_NAME || process.env.POSTGRES_DATABASE,
        port: Number(process.env.SQL_PORT || process.env.POSTGRES_PORT || 5432),
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: process.env.VERCEL ? 2 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } catch (poolErr) {
      console.error('Failed to initialize pg.Pool with host config:', poolErr);
      return null;
    }
  }

  if (global._postgresPool) {
    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.warn('PostgreSQL idle client error (handled):', err?.message || err);
    });
  }

  return global._postgresPool || null;
};

export async function ensureTablesExist(p: Pool) {
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        uid text NOT NULL UNIQUE,
        username text NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        club text,
        email text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
  } catch (err: any) {
    console.warn('ensureTablesExist notice:', err?.message || err);
  }
}

// Create or retrieve the pool instance.
export const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const sqlDb = pool ? drizzle(pool, { schema }) : null;
