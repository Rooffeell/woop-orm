import type { BaseQueryBuilder } from './BaseQueryBuilder';

export interface DBAdapter {
  query(sql: string, params?: any[]): Promise<any[]>;
  connect(): Promise<void>;
  close(): Promise<void>;
  createQueryBuilder<T>(table: string): BaseQueryBuilder<T>;
}
