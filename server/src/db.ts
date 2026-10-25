import { Pool } from 'pg';
import dotenv from 'dotenv';

import path from 'path';
import fs from 'fs';

dotenv.config();

const rawDatabaseUrl = process.env.DATABASE_URL || 'postgresql://carering_user:carering_secure_password@localhost:5433/carering';
const databaseUrl = rawDatabaseUrl.trim();
const isRemoteDb = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1');
const useSsl = process.env.DB_SSL === 'true' || isRemoteDb || databaseUrl.includes('sslmode=require');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export const query = async <T = any>(text: string, params?: any[]): Promise<T[]> => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 150) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return res.rows;
  } catch (err) {
    console.error('[DB] Query execution failed:', { text: text.substring(0, 100), err });
    throw err;
  }
};

export interface DbHealthResult {
  status: 'connected' | 'disconnected';
  latencyMs: number;
  postgis: {
    installed: boolean;
  };
  error?: string;
}

export async function checkDatabaseHealth(timeoutMs: number = 5000): Promise<DbHealthResult> {
  const start = Date.now();

  const checkPromise = async (): Promise<Omit<DbHealthResult, 'latencyMs'>> => {
    await pool.query('SELECT 1');

    let postgisInstalled = false;
    try {
      const extRes = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'postgis'");
      if (extRes.rows && extRes.rows.length > 0) {
        postgisInstalled = true;
      }
    } catch {
      // Non-fatal if extension table check fails
    }

    return {
      status: 'connected',
      postgis: {
        installed: postgisInstalled,
      },
    };
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs)
  );

  try {
    const result = await Promise.race([checkPromise(), timeoutPromise]);
    return {
      ...result,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    // Log internal error safely on the server, NEVER leak credentials, hostnames or raw error to public client
    console.error('[DB Health] Ping check failed:', err?.message || err);
    return {
      status: 'disconnected',
      latencyMs: Date.now() - start,
      postgis: {
        installed: false,
      },
      error: 'Service temporarily unavailable',
    };
  }
}

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    const res = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );
    if (!res.rows || res.rows.length === 0) {
      console.log('🔄 [DB] Table "users" does not exist. Automatically initializing database schema from schema.sql...');
      const candidatePaths = [
        path.resolve(__dirname, '../../database/schema.sql'),
        path.resolve(__dirname, '../database/schema.sql'),
        path.resolve(process.cwd(), '../database/schema.sql'),
        path.resolve(process.cwd(), 'database/schema.sql'),
      ];
      const schemaPath = candidatePaths.find(p => fs.existsSync(p));
      if (schemaPath) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(sql);
        console.log('✅ [DB] Database schema successfully initialized!');
      } else {
        console.warn('⚠️ [DB] schema.sql not found in candidate paths:', candidatePaths);
      }
    } else {
      console.log('✅ [DB] Database schema verified (users table exists).');
    }
  } catch (err: any) {
    console.error('⚠️ [DB] Database schema verification/initialization failed:', err?.message || err);
  }
}

export default pool;
