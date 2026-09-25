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

export const getClient = () => pool.connect();

export default pool;
