import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pgPackage = process.env.PG_PACKAGE_NAME || 'pg';
const { Pool } = require(pgPackage);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://woop:woop_password@localhost:5434/woop_db',
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
