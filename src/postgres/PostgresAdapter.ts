import { Pool, type PoolConfig, type QueryResult } from 'pg';
import type { DBAdapter } from '../core/DBAdapter';
import type { BaseQueryBuilder } from '../core/BaseQueryBuilder';
import { PostgresQueryBuilder } from './PostgresQueryBuilder';

export class PostgresAdapter implements DBAdapter {
  private pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    // Pool connects lazily, but we can verify connection
    const client = await this.pool.connect();
    client.release();
  }

  async query(text: string, params?: any[]): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result: QueryResult = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  createQueryBuilder<T>(table: string): BaseQueryBuilder<T> {
    return new PostgresQueryBuilder<T>(this, table);
  }
}
