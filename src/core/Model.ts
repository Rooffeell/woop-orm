import 'reflect-metadata';
import { WoopORM } from './WoopORM';
import type { BaseQueryBuilder } from './BaseQueryBuilder';
import { TABLE_NAME_KEY, COLUMNS_KEY } from './Decorators';

export abstract class Model {
  // Legacy static property support
  static tableName: string;

  private static getTableName(): string {
    const metaTable = Reflect.getMetadata(TABLE_NAME_KEY, this);
    if (metaTable) return metaTable;

    // Fallback to static property or class name
    // @ts-ignore
    return this.tableName || this.name.toLowerCase() + 's';
  }

  private getColumnData(): Record<string, any> {
    const columns: { property: string; columnName: string }[] = 
      Reflect.getMetadata(COLUMNS_KEY, this.constructor) || [];
    
    const data: Record<string, any> = {};
    const self = this as any;

    if (columns.length > 0) {
      // Only extract decorated columns
      for (const col of columns) {
        if (self[col.property] !== undefined) {
          data[col.columnName] = self[col.property];
        }
      }
    } else {
      // Fallback: use all properties (dangerous but backward compatible)
      Object.assign(data, self);
    }
    
    return data;
  }

  // Helper to map input data (property names) to DB columns
  private static mapToDbColumns(constructor: Function, data: Record<string, any>): Record<string, any> {
     const columns: { property: string; columnName: string }[] = 
      Reflect.getMetadata(COLUMNS_KEY, constructor) || [];
    
    if (columns.length === 0) return data;

    const dbData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
        const col = columns.find(c => c.property === key);
        if (col) {
            dbData[col.columnName] = value;
        } else {
            // If strict, we might ignore this. For now, pass through?
            // Actually, if we use decorators, we should probably ONLY pass decorated fields.
            // But for create({ name: '...' }), the keys are properties.
            dbData[key] = value; 
        }
    }
    return dbData;
  }

  static query<T extends Model>(this: new () => T): BaseQueryBuilder<T> {
    const adapter = WoopORM.getAdapter();
    // @ts-ignore
    const table = this.getTableName();
    
    return adapter.createQueryBuilder<T>(table);
  }

  static async find<T extends Model>(this: new () => T, id: any): Promise<T | null> {
    // @ts-ignore
    return this.query().where('id', '=', id).first();
  }

  static async all<T extends Model>(this: new () => T): Promise<T[]> {
    // @ts-ignore
    return this.query().get();
  }

  static async create<T extends Model>(this: new () => T, data: Partial<T>): Promise<T> {
    // We need to map property names in 'data' to column names!
    // @ts-ignore
    const dbData = this.mapToDbColumns(this, data);

    // @ts-ignore
    return this.query().insert(dbData);
  }

  async save(): Promise<this> {
    const constructor = this.constructor as typeof Model;
    // @ts-ignore
    const table = constructor.getTableName();
    const adapter = WoopORM.getAdapter();
    const qb = adapter.createQueryBuilder(table);

    const data = this.getColumnData();
    const self = this as any;
    
    // We assume 'id' is the primary key for now
    if (self.id) {
        const { id, ...updateData } = data;
        await qb.where('id', '=', id).update(updateData);
        return this;
    } else {
        const result = await qb.insert(data);
        Object.assign(this, result);
        return this;
    }
  }

  async delete(): Promise<void> {
    const self = this as any;
    const constructor = this.constructor as typeof Model;
    // @ts-ignore
    const table = constructor.getTableName();
    const adapter = WoopORM.getAdapter();
    
    const qb = adapter.createQueryBuilder(table);

    if (self.id) {
        await qb.where('id', '=', self.id).delete();
    }
  }
}
