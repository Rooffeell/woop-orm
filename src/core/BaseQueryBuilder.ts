import type { DBAdapter } from './DBAdapter';

export abstract class BaseQueryBuilder<T> {
  protected adapter: DBAdapter;
  protected table: string;

  constructor(adapter: DBAdapter, table: string) {
    this.adapter = adapter;
    this.table = table;
  }

  abstract where(column: string, operator: string, value: any): this;
  abstract limit(limit: number): this;
  abstract offset(offset: number): this;
  abstract orderBy(column: string, direction: 'ASC' | 'DESC'): this;
  
  abstract get(): Promise<T[]>;
  abstract first(): Promise<T | null>;
  abstract insert(data: Partial<T>): Promise<T>;
  abstract update(data: Partial<T>): Promise<T[]>;
  abstract delete(): Promise<void>;
}
