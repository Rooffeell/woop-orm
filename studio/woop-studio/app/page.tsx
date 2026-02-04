import { ModeToggle } from "@/components/mode-toggle";
import { query } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SchemaSelector } from "@/components/schema-selector";
import { TableActions } from "@/components/table-actions";
import { DataTable } from "@/components/data-table";
import { SchemaGraph } from "@/components/schema-graph";
import { Network, Table2 } from "lucide-react";

import { PaginationControls } from "@/components/pagination-controls";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ 
    table?: string; 
    schema?: string;
    filter_col?: string;
    filter_op?: string;
    filter_val?: string;
    filters?: string;
    sort_col?: string;
    sort_order?: string;
    page?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedSchema = params.schema || 'public';
  const selectedTable = params.table;
  const filterCol = params.filter_col;
  const filterOp = params.filter_op;
  const filterVal = params.filter_val;
  const filtersParam = params.filters;
  const sortCol = params.sort_col;
  const sortOrder = params.sort_order;
  const page = Number(params.page) || 1;
  const view = params.view || 'data';
  const limit = 100;
  const offset = (page - 1) * limit;

  // 0. Fetch Schemas
  const { rows: schemaRows } = await query(`
    SELECT schema_name 
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND schema_name NOT LIKE 'pg_temp_%'
    AND schema_name NOT LIKE 'pg_toast_temp_%'
    ORDER BY schema_name
  `);
  const schemas = schemaRows.map((r: any) => r.schema_name);

  // 1. Fetch Tables for Selected Schema
  const { rows: tables } = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = $1
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [selectedSchema]);

  // Graph Data
  let graphTables: any[] = [];
  let graphRelationships: any[] = [];

  if (view === 'graph') {
      const { rows: allColumns } = await query(`
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position
      `, [selectedSchema]);

      const { rows: fks } = await query(`
        SELECT
            tc.table_name as "fromTable",
            kcu.column_name as "fromColumn",
            ccu.table_name as "toTable",
            ccu.column_name as "toColumn"
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
      `, [selectedSchema]);

      // Determine PKs for graph
      const { rows: pks } = await query(`
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
        WHERE kcu.table_schema = $1
          AND tc.constraint_type = 'PRIMARY KEY'
      `, [selectedSchema]);

      const pkMap = new Set(pks.map((p: any) => `${p.table_name}.${p.column_name}`));

      // Group columns by table
      const tablesMap = new Map();
      allColumns.forEach((col: any) => {
          if (!tablesMap.has(col.table_name)) {
              tablesMap.set(col.table_name, []);
          }
          tablesMap.get(col.table_name).push({
              name: col.column_name,
              type: col.data_type,
              isPk: pkMap.has(`${col.table_name}.${col.column_name}`)
          });
      });

      graphTables = Array.from(tablesMap.entries()).map(([tableName, columns]) => ({
          tableName,
          columns
      }));

      graphRelationships = fks;
  }

  // 2. Fetch Data if table selected (ONLY IF VIEW IS DATA)
  let tableData: any[] = [];
  let columns: string[] = [];
  let columnDefs: any[] = [];
  let primaryKey: string[] = [];
  let totalRows = 0;
  let error = null;

  if (view === 'data' && selectedTable) {
    // Security check: ensure selectedTable is in the list of tables
    const tableExists = tables.some((t: any) => t.table_name === selectedTable);
    
    if (tableExists) {
      try {
        // Fetch detailed column info
        const colResult = await query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = $2
            ORDER BY ordinal_position
        `, [selectedTable, selectedSchema]);
        columnDefs = colResult.rows;

        // Fetch Primary Key
        const pkResult = await query(`
            SELECT kcu.column_name
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc
              ON kcu.constraint_name = tc.constraint_name
              AND kcu.table_schema = tc.table_schema
            WHERE kcu.table_schema = $1
              AND kcu.table_name = $2
              AND tc.constraint_type = 'PRIMARY KEY'
        `, [selectedSchema, selectedTable]);
        primaryKey = pkResult.rows.map((r: any) => r.column_name);

        // Use double quotes for schema and table to handle special characters/case sensitivity
        let queryStr = `SELECT * FROM "${selectedSchema}"."${selectedTable}"`;
        let countQueryStr = `SELECT COUNT(*) as count FROM "${selectedSchema}"."${selectedTable}"`;
        const queryParams: any[] = [];
        let whereClause = "";
        
        const filters: Array<{ col: string, op: string, val: string }> = [];

        // Support legacy single filter params
        if (filterCol && filterOp && filterVal) {
            filters.push({ col: filterCol, op: filterOp, val: filterVal });
        }
        
        // Support new multiple filters param
        if (filtersParam) {
            try {
                const parsed = JSON.parse(filtersParam);
                if (Array.isArray(parsed)) {
                    filters.push(...parsed);
                }
            } catch (e) {
                console.error("Failed to parse filters param", e);
            }
        }

        if (filters.length > 0) {
             const conditions: string[] = [];
             
             filters.forEach((filter) => {
                 const isValidCol = columnDefs.some((c: any) => c.column_name === filter.col);
                 if (isValidCol) {
                     let op = "=";
                     switch (filter.op) {
                         case 'eq': op = '='; break;
                         case 'neq': op = '!='; break;
                         case 'gt': op = '>'; break;
                         case 'lt': op = '<'; break;
                         case 'gte': op = '>='; break;
                         case 'lte': op = '<='; break;
                         case 'like': op = 'LIKE'; break;
                         case 'ilike': op = 'ILIKE'; break;
                         default: op = '=';
                     }
                     
                     let val = filter.val;
                     if (filter.op === 'like' || filter.op === 'ilike') {
                         val = `%${filter.val}%`;
                     }
    
                     conditions.push(`"${filter.col}" ${op} $${queryParams.length + 1}`);
                     queryParams.push(val);
                 }
             });

             if (conditions.length > 0) {
                 whereClause = ` WHERE ${conditions.join(" AND ")}`;
             }
        }

        queryStr += whereClause;
        countQueryStr += whereClause;

        // Sorting
        if (sortCol && sortOrder) {
             const isValidSortCol = columnDefs.some((c: any) => c.column_name === sortCol);
             if (isValidSortCol) {
                 const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                 queryStr += ` ORDER BY "${sortCol}" ${order}`;
             }
        } else if (primaryKey.length > 0) {
            queryStr += ` ORDER BY "${primaryKey[0]}" ASC`;
        }

        queryStr += ` LIMIT ${limit} OFFSET ${offset}`;

        const [result, countResult] = await Promise.all([
            query(queryStr, queryParams),
            query(countQueryStr, queryParams)
        ]);

        tableData = result.rows;
        totalRows = parseInt(countResult.rows[0].count, 10);
        
        if (tableData.length > 0) {
            columns = Object.keys(tableData[0]);
        } else {
            // If empty, fetch columns from schema
            columns = columnDefs.map((r: any) => r.column_name);
        }
      } catch (e: any) {
        error = e.message;
      }
    } else {
      error = "Table not found";
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 border-r bg-muted/10 flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between border-b bg-muted/20">
          <div className="font-bold text-lg tracking-tight">Woop Studio</div>
          <ModeToggle />
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Schema
            </h2>
            <SchemaSelector schemas={schemas} currentSchema={selectedSchema} />
          </div>

          <Separator className="my-4 mx-4 w-auto" />

           <div className="px-4 mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Views
            </h2>
             <nav className="space-y-0.5">
                <Link
                    href={`/?schema=${selectedSchema}&view=graph`}
                    className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    view === 'graph'
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <Network className="mr-2 h-4 w-4" />
                    Schema Graph
                </Link>
             </nav>
           </div>

          <div className="px-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tables
            </h2>
            <nav className="space-y-0.5">
              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground px-2">No tables found.</p>
              ) : (
                tables.map((table: any) => {
                   const isActive = view === 'data' && selectedTable === table.table_name;
                   return (
                    <Link
                        key={table.table_name}
                        href={`/?schema=${selectedSchema}&table=${table.table_name}&view=data`}
                        className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive 
                            ? "bg-primary/10 text-primary" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Table2 className="mr-2 h-4 w-4 opacity-70" />
                        {table.table_name}
                    </Link>
                   );
                })
              )}
            </nav>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {view === 'graph' ? (
            <>
                <div className="h-14 px-6 flex items-center border-b bg-background z-20">
                    <h1 className="text-lg font-semibold flex items-center">
                        <Network className="mr-2 h-5 w-5" />
                        Schema Visualization
                    </h1>
                </div>
                <div className="flex-1 overflow-hidden bg-background">
                    <SchemaGraph tables={graphTables} relationships={graphRelationships} />
                </div>
            </>
        ) : selectedTable ? (
          <>
            <div className="h-14 px-6 flex items-center justify-between border-b bg-background z-20">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{selectedTable}</h1>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {tableData.length > 0 
                    ? `Showing ${offset + 1}-${offset + tableData.length} of ${totalRows} rows`
                    : totalRows > 0 ? 'Page out of range' : '0 rows'}
                </span>
              </div>
              
              <TableActions 
                schema={selectedSchema} 
                table={selectedTable} 
                columns={columnDefs} 
              />
            </div>
            
            {/* Table Container - No Padding, Full Size */}
            <div className="flex-1 overflow-hidden bg-background flex flex-col">
               {error ? (
                   <div className="m-8 rounded-md bg-destructive/15 p-4 text-destructive">
                       Error: {error}
                   </div>
               ) : (
                   <>
                       <div className="flex-1 overflow-hidden">
                           <DataTable 
                             data={tableData} 
                             columns={columns} 
                             primaryKey={primaryKey}
                             schema={selectedSchema}
                             table={selectedTable}
                             columnDefs={columnDefs}
                             sortCol={sortCol}
                             sortOrder={sortOrder}
                           />
                       </div>
                       <PaginationControls 
                           currentPage={page}
                           hasNextPage={offset + limit < totalRows}
                           hasPrevPage={page > 1}
                           baseUrl="/"
                           searchParams={{
                               schema: selectedSchema,
                               table: selectedTable,
                               filter_col: filterCol,
                               filter_op: filterOp,
                               filter_val: filterVal,
                               sort_col: sortCol,
                               sort_order: sortOrder,
                               view: 'data'
                           }}
                       />
                   </>
               )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
            <div className="p-4 rounded-full bg-muted mb-4">
                <Table2 className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium">Select a table to view data</p>
          </div>
        )}
      </main>
    </div>
  );
}
