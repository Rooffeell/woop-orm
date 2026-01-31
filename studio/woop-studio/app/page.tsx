import { ModeToggle } from "@/components/mode-toggle";
import { query } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SchemaSelector } from "@/components/schema-selector";
import { TableActions } from "@/components/table-actions";
import { DataTable } from "@/components/data-table";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; schema?: string }>;
}) {
  const params = await searchParams;
  const selectedSchema = params.schema || 'public';
  const selectedTable = params.table;

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

  // 2. Fetch Data if table selected
  let tableData: any[] = [];
  let columns: string[] = [];
  let columnDefs: any[] = [];
  let primaryKey: string[] = [];
  let error = null;

  if (selectedTable) {
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
        const result = await query(`SELECT * FROM "${selectedSchema}"."${selectedTable}" LIMIT 100`);
        tableData = result.rows;
        
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

          <div className="px-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tables
            </h2>
            <nav className="space-y-0.5">
              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground px-2">No tables found.</p>
              ) : (
                tables.map((table: any) => {
                   const isActive = selectedTable === table.table_name;
                   return (
                    <Link
                        key={table.table_name}
                        href={`/?schema=${selectedSchema}&table=${table.table_name}`}
                        className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isActive 
                            ? "bg-primary/10 text-primary" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
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
        {selectedTable ? (
          <>
            <div className="h-14 px-6 flex items-center justify-between border-b bg-background z-20">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{selectedTable}</h1>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {tableData.length} rows
                </span>
              </div>
              
              <TableActions 
                schema={selectedSchema} 
                table={selectedTable} 
                columns={columnDefs} 
              />
            </div>
            
            {/* Table Container - No Padding, Full Size */}
            <div className="flex-1 overflow-hidden bg-background">
               {error ? (
                   <div className="m-8 rounded-md bg-destructive/15 p-4 text-destructive">
                       Error: {error}
                   </div>
               ) : (
                   <DataTable 
                     data={tableData} 
                     columns={columns} 
                     primaryKey={primaryKey}
                     schema={selectedSchema}
                     table={selectedTable}
                     columnDefs={columnDefs}
                   />
               )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
            <div className="p-4 rounded-full bg-muted mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-table-2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
            </div>
            <p className="text-lg font-medium">Select a table to view data</p>
          </div>
        )}
      </main>
    </div>
  );
}
