import { BaseQueryBuilder } from '../core/BaseQueryBuilder';

export class PostgresQueryBuilder<T> extends BaseQueryBuilder<T> {
  private conditions: string[] = [];
  private params: any[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private orderByClause?: string;

  where(column: string, operator: string, value: any): this {
    this.params.push(value);
    this.conditions.push(`${column} ${operator} $${this.params.length}`);
    return this;
  }

  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = `${column} ${direction}`;
    return this;
  }

  async get(): Promise<T[]> {
    let query = `SELECT * FROM ${this.table}`;
    
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }

    if (this.orderByClause) {
      query += ` ORDER BY ${this.orderByClause}`;
    }

    if (this.limitValue !== undefined) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    return this.adapter.query(query, this.params);
  }

  async first(): Promise<T | null> {
    this.limit(1);
    const results = await this.get();
    return results[0] || null;
  }

  async insert(data: Partial<T>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`);

    const query = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    
    const rows = await this.adapter.query(query, values);
    return rows[0];
  }

  async update(data: Partial<T>): Promise<T[]> {
    const updates: string[] = [];
    const updateParams: any[] = [];
    let paramCounter = 1;

    for (const [key, value] of Object.entries(data)) {
      updates.push(`${key} = $${paramCounter}`);
      updateParams.push(value);
      paramCounter++;
    }

    let query = `UPDATE ${this.table} SET ${updates.join(', ')}`;
    
    if (this.conditions.length > 0) {
      const whereConditions = this.conditions.map(cond => {
        return cond.replace(/\$(\d+)/g, (_, match) => `$${parseInt(match) + paramCounter - 1}`);
      });
      query += ` WHERE ${whereConditions.join(' AND ')}`;
      updateParams.push(...this.params);
    }

    query += ` RETURNING *`;

    return this.adapter.query(query, updateParams);
  }

  async delete(): Promise<void> {
    let query = `DELETE FROM ${this.table}`;
    
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }

    await this.adapter.query(query, this.params);
  }
}
