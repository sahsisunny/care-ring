import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgresql://carering_user:carering_secure_password@localhost:5433/carering';
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
  pool: {
    total: number;
    idle: number;
    waiting: number;
  };
  postgis: {
    installed: boolean;
    version: string | null;
  };
  serverTime?: string;
  pgVersion?: string;
  error?: string;
}

export async function checkDatabaseHealth(timeoutMs: number = 5000): Promise<DbHealthResult> {
  const start = Date.now();
  const poolStats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };

  const checkPromise = async (): Promise<Omit<DbHealthResult, 'latencyMs' | 'pool'>> => {
    const res = await pool.query('SELECT 1 as alive, NOW() as server_time, version() as pg_version');
    const row = res.rows[0];
    const serverTime =
      row?.server_time instanceof Date
        ? row.server_time.toISOString()
        : String(row?.server_time || '');
    const pgVersion =
      typeof row?.pg_version === 'string'
        ? row.pg_version.split(' ')[0] + ' ' + (row.pg_version.split(' ')[1] || '')
        : row?.pg_version;

    let postgisInstalled = false;
    let postgisVersion: string | null = null;
    try {
      const extRes = await pool.query("SELECT extversion FROM pg_extension WHERE extname = 'postgis'");
      if (extRes.rows && extRes.rows.length > 0) {
        postgisInstalled = true;
        postgisVersion = extRes.rows[0].extversion;
      }
    } catch {
      // PostGIS extension lookup non-fatal
    }

    return {
      status: 'connected',
      serverTime,
      pgVersion,
      postgis: {
        installed: postgisInstalled,
        version: postgisVersion,
      },
    };
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Database health check timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    const result = await Promise.race([checkPromise(), timeoutPromise]);
    return {
      ...result,
      latencyMs: Date.now() - start,
      pool: poolStats,
    };
  } catch (err: any) {
    return {
      status: 'disconnected',
      latencyMs: Date.now() - start,
      pool: poolStats,
      postgis: {
        installed: false,
        version: null,
      },
      error: err?.message || 'Database connection failed',
    };
  }
}

export default pool;
