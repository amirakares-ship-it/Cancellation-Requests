import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
}

// Helper to sanitize connection strings from Neon / Supabase / Vercel
function cleanConnectionString(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  let url = rawUrl.trim();
  // Strip surrounding quotes if any
  url = url.replace(/^["']|["']$/g, '');
  // Remove channel_binding parameter as node-postgres does not support SCRAM channel binding
  url = url.replace(/([?&])channel_binding=[^&]*(&|$)/g, '$1');
  // Remove trailing ? or &
  url = url.replace(/[?&]$/, '');
  return url;
}

export const createPool = (): Pool | null => {
  if (global._postgresPool) {
    return global._postgresPool;
  }

  const rawConn =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.SQL_URL;

  const connectionString = cleanConnectionString(rawConn);

  if (connectionString) {
    try {
      const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      global._postgresPool = new Pool({
        connectionString,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 2 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      console.log('PostgreSQL Pool initialized with connection string.');
    } catch (poolErr) {
      console.error('Failed to initialize pg.Pool with connectionString:', poolErr);
      return null;
    }
  } else if (process.env.SQL_HOST || process.env.POSTGRES_HOST || process.env.PGHOST) {
    try {
      const host = process.env.SQL_HOST || process.env.POSTGRES_HOST || process.env.PGHOST;
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';
      const useSsl = process.env.SQL_SSL === 'true' || process.env.POSTGRES_SSL === 'true' || (!isLocalhost && !process.env.SQL_HOST);
      
      global._postgresPool = new Pool({
        host,
        user: process.env.SQL_USER || process.env.POSTGRES_USER || process.env.PGUSER,
        password: process.env.SQL_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD,
        database: process.env.SQL_DB_NAME || process.env.POSTGRES_DATABASE || process.env.PGDATABASE,
        port: Number(process.env.SQL_PORT || process.env.POSTGRES_PORT || 5432),
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: process.env.VERCEL ? 2 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      console.log('PostgreSQL Pool initialized with host parameters.');
    } catch (poolErr) {
      console.error('Failed to initialize pg.Pool with host config:', poolErr);
      return null;
    }
  }

  if (global._postgresPool) {
    global._postgresPool.on('error', (err) => {
      console.warn('PostgreSQL idle client notice (caught):', err?.message || err);
    });
  }

  return global._postgresPool || null;
};

export async function ensureTablesExist(p: Pool): Promise<boolean> {
  try {
    const queryPromise = p.query(`
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

    // Attach catch handler so background network failures don't cause unhandled promise rejections
    queryPromise.catch(() => {});

    // Add timeout promise to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Table creation query timed out')), 2500)
    );

    await Promise.race([queryPromise, timeoutPromise]);
    return true;
  } catch (err: any) {
    console.warn('ensureTablesExist notice (proceeding safely):', err?.message || err);
    return false;
  }
}

// Create or retrieve the pool instance.
export const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const sqlDb = pool ? drizzle(pool, { schema }) : null;
