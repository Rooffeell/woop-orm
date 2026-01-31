import 'reflect-metadata';

export const TABLE_NAME_KEY = 'woop:tableName';
export const COLUMNS_KEY = 'woop:columns';

export function Entity(tableName?: string) {
  return function (constructor: Function) {
    const name = tableName || constructor.name.toLowerCase() + 's';
    Reflect.defineMetadata(TABLE_NAME_KEY, name, constructor);
  };
}

export interface ColumnOptions {
  name?: string;
  primary?: boolean;
}

export function Column(options: ColumnOptions = {}) {
  return function (target: any, propertyKey: string) {
    const columns = Reflect.getMetadata(COLUMNS_KEY, target.constructor) || [];
    columns.push({
      property: propertyKey,
      columnName: options.name || propertyKey,
    });
    Reflect.defineMetadata(COLUMNS_KEY, columns, target.constructor);
  };
}
