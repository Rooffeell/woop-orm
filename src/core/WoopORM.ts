import type { DBAdapter } from './DBAdapter';
import { PostgresAdapter } from '../postgres/PostgresAdapter';
import type { PoolConfig } from 'pg';

export interface WoopOptions extends PoolConfig {
  type: 'postgres';
}

export class WoopORM {
  private static adapter: DBAdapter;

  static connect(options: WoopOptions) {
    if (options.type === 'postgres') {
      this.adapter = new PostgresAdapter(options);
    } else {
      throw new Error(`Unsupported database type: ${(options as any).type}`);
    }
  }

  static setAdapter(adapter: DBAdapter) {
    this.adapter = adapter;
  }

  static getAdapter(): DBAdapter {
    if (!this.adapter) {
      throw new Error("WoopORM adapter not initialized. Call WoopORM.connect() or setAdapter() first.");
    }
    return this.adapter;
  }
}
