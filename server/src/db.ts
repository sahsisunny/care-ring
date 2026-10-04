import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://carering_user:carering_secure_password@localhost:5433/carering';
const isRemoteDb = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1');
const useSsl = process.env.DB_SSL === 'true' || isRemoteDb || databaseUrl.includes('sslmode=require');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 300000, // Keep connection alive for 5 minutes
  connectionTimeoutMillis: 20000, // 20s connection timeout for cross-region Neon serverless
  keepAlive: true,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

// Periodic keepalive to keep Neon serverless compute warm and eliminate cold-start latency
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    // Silent catch, pool will automatically reconnect on next query
  }
}, 45000);

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

export const getClient = () => pool.connect();

export default pool;
