'use server'

import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function insertRecord(schema: string, table: string, data: Record<string, any>) {
  try {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    if (columns.length === 0) {
      return { success: false, error: "No data provided" };
    }

    const columnNames = columns.map(col => `"${col}"`).join(", ");
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    
    const sql = `INSERT INTO "${schema}"."${table}" (${columnNames}) VALUES (${placeholders})`;
    
    await query(sql, values);
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Insert error:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteRecords(schema: string, table: string, identifiers: Record<string, any>[]) {
  try {
    if (identifiers.length === 0) return { success: true };

    // Assuming identifiers are objects with PK column(s) and value(s)
    // For simplicity, we'll handle single PK for now, or use logic to build WHERE clause
    // But since we want to support generic tables, let's look at the first identifier keys
    const pkColumns = Object.keys(identifiers[0]);
    
    if (pkColumns.length === 0) {
        return { success: false, error: "No primary key found for deletion" };
    }

    // Construct WHERE clause for multiple deletions
    // DELETE FROM table WHERE (pk1, pk2) IN ((v1, v2), (v3, v4))
    // Or if single PK: DELETE FROM table WHERE pk1 IN (v1, v2)

    const values: any[] = [];
    let paramCounter = 1;

    const whereConditions = identifiers.map(id => {
        const conditions = pkColumns.map(col => {
            values.push(id[col]);
            return `"${col}" = $${paramCounter++}`;
        });
        return `(${conditions.join(' AND ')})`;
    }).join(' OR ');

    const sql = `DELETE FROM "${schema}"."${table}" WHERE ${whereConditions}`;
    
    await query(sql, values);
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Delete error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateRecord(schema: string, table: string, identifier: Record<string, any>, data: Record<string, any>) {
  try {
    const pkColumns = Object.keys(identifier);
    const updateColumns = Object.keys(data);
    
    if (pkColumns.length === 0 || updateColumns.length === 0) {
      return { success: false, error: "Invalid update data" };
    }

    const values: any[] = [];
    let paramCounter = 1;

    const setClause = updateColumns.map(col => {
        values.push(data[col]);
        return `"${col}" = $${paramCounter++}`;
    }).join(', ');

    const whereClause = pkColumns.map(col => {
        values.push(identifier[col]);
        return `"${col}" = $${paramCounter++}`;
    }).join(' AND ');

    const sql = `UPDATE "${schema}"."${table}" SET ${setClause} WHERE ${whereClause}`;
    
    await query(sql, values);
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Update error:", error);
    return { success: false, error: error.message };
  }
}
