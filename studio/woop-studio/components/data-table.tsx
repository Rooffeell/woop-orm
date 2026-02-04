"use client"

import { useState, useEffect, useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Trash2, Edit, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { deleteRecords, updateRecord } from "@/app/actions"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTableProps {
  data: any[]
  columns: string[]
  primaryKey: string[]
  schema: string
  table: string
  columnDefs: any[]
  sortCol?: string
  sortOrder?: string
}

function CellEditor({ 
    value: initialValue, 
    inputType, 
    onSave, 
    onCancel 
}: { 
    value: any, 
    inputType: string, 
    onSave: (val: any) => void, 
    onCancel: () => void 
}) {
    const [value, setValue] = useState(() => {
        if (initialValue === null || initialValue === undefined) return '';
        
        try {
            let valToParse = initialValue;
            // Handle case where date might be stringified with quotes (e.g. legacy or json)
            if (typeof valToParse === 'string' && valToParse.startsWith('"') && valToParse.endsWith('"')) {
                try {
                    valToParse = JSON.parse(valToParse);
                } catch {}
            }

            if (inputType === 'date') {
                const date = new Date(valToParse);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
            if (inputType === 'datetime-local') {
                const date = new Date(valToParse);
                if (!isNaN(date.getTime())) {
                    // Format for datetime-local: YYYY-MM-DDTHH:mm
                    // We need local time usually, but here we use ISO (UTC) which might be confusing if not handled.
                    // But standard input type=datetime-local expects this format.
                    // Actually, ISO string is UTC. 
                    // If we want to preserve the exact string from DB, we should use it if it parses?
                    // But `new Date(valToParse)` parses it.
                    // Let's stick to ISO slice for now as it's consistent with typical DB timestamp storage.
                    return date.toISOString().slice(0, 16);
                }
            }
        } catch (e) {
            console.error("Failed to parse date", e);
        }
        
        return initialValue ?? ''
    })
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSave(value)
        } else if (e.key === 'Escape') {
            onCancel()
        }
    }

    if (inputType === 'boolean') {
        return (
             <div className="w-full h-full">
                <Select
                    value={value === true || value === 'true' ? "true" : "false"}
                    onValueChange={(val) => {
                         onSave(val === 'true');
                    }}
                    defaultOpen={true}
                    onOpenChange={(open) => {
                        if (!open) onCancel();
                    }}
                >
                    <SelectTrigger className="w-full h-full border-none bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 px-4 py-2 shadow-none rounded-none text-left font-normal">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                </Select>
             </div>
        )
    }

    if (inputType === 'text' || inputType === 'json') {
        return (
            <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => onSave(value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="min-h-[40px] w-full border border-primary rounded-sm focus-visible:ring-1 focus-visible:ring-primary resize-none py-2 px-4 bg-background leading-normal absolute top-0 left-0 z-50 shadow-lg overflow-hidden"
            />
        )
    }

    return (
        <Input
            type={inputType === 'json' ? 'text' : inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onSave(value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-full w-full border-none rounded-none focus-visible:ring-0 px-4 py-2 shadow-none bg-background"
        />
    )
}

export function DataTable({ data, columns, primaryKey, schema, table, columnDefs, sortCol, sortOrder }: DataTableProps) {
  const router = useRouter()
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowId: string, col: string, value: any } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string, col: string } | null>(null)

  // Reset selection when data changes (e.g. table switch)
  useEffect(() => {
    setSelectedRows(new Set())
    setEditingCell(null)
    setSelectedCell(null)
  }, [table, schema])

  const getRowId = (row: any) => {
    if (primaryKey.length > 0) {
        return JSON.stringify(primaryKey.reduce((acc, col) => ({ ...acc, [col]: row[col] }), {}));
    }
    // Fallback if no PK (unsafe for deletion, but needed for key)
    return JSON.stringify(row);
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map(row => getRowId(row))
      setSelectedRows(new Set(allIds))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleSelectRow = (rowId: string, checked: boolean) => {
    const newSelected = new Set(selectedRows)
    if (checked) {
      newSelected.add(rowId)
    } else {
      newSelected.delete(rowId)
    }
    setSelectedRows(newSelected)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    const identifiers = Array.from(selectedRows).map(idStr => JSON.parse(idStr));
    
    const result = await deleteRecords(schema, table, identifiers);
    
    setIsDeleting(false);
    if (result.success) {
        setSelectedRows(new Set());
        setDeleteDialogOpen(false);
        router.refresh();
    } else {
        alert("Failed to delete: " + result.error);
    }
  }

  const handleEditClick = () => {
    if (selectedRows.size !== 1) return;
    const rowIdStr = Array.from(selectedRows)[0];
    const rowIdObj = JSON.parse(rowIdStr);
    
    // Find the row data
    const rowData = data.find(r => getRowId(r) === rowIdStr);
    if (rowData) {
        setEditData({ ...rowData });
        setIsEditing(true);
        setError(null);
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const rowIdStr = Array.from(selectedRows)[0];
    const identifier = JSON.parse(rowIdStr);

    // Process editData to parse JSON fields
    const processedEditData = { ...editData };
    for (const col of columnDefs) {
        if (col.data_type.includes('json') && typeof processedEditData[col.column_name] === 'string') {
             try {
                 processedEditData[col.column_name] = JSON.parse(processedEditData[col.column_name]);
             } catch (e) {
                 setError(`Invalid JSON in column ${col.column_name}`);
                 setIsSubmitting(false);
                 return;
             }
        }
    }

    const result = await updateRecord(schema, table, identifier, processedEditData);
    
    setIsSubmitting(false);
    if (result.success) {
        setIsEditing(false);
        setSelectedRows(new Set()); // Clear selection as ID might have changed
        router.refresh();
    } else {
        setError(result.error || "Failed to update");
    }
  }
  
  const getInputType = (dataType: string) => {
    if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('float') || dataType.includes('double')) return 'number'
    if (dataType.includes('date')) return 'date'
    if (dataType.includes('timestamp')) return 'datetime-local'
    if (dataType.includes('bool')) return 'boolean'
    if (dataType.includes('json')) return 'json'
    return 'text'
  }

  // Inline Editing Handlers
  const handleCellDoubleClick = (rowId: string, col: string, value: any) => {
      // Don't allow editing PKs inline for simplicity
      if (primaryKey.includes(col)) return;
      
      let initialValue = value;
      const colDef = columnDefs.find(c => c.column_name === col);
      
      const isDateOrTime = colDef?.data_type.includes('date') || colDef?.data_type.includes('timestamp') || colDef?.data_type.includes('time');

      if (!isDateOrTime && (colDef?.data_type.includes('json') || (typeof value === 'object' && value !== null))) {
          initialValue = JSON.stringify(value);
      }
      
      setEditingCell({ rowId, col, value: initialValue });
  }

  const saveCellValue = async (rowId: string, col: string, value: any) => {
      const identifier = JSON.parse(rowId);
      
      const colDef = columnDefs.find(c => c.column_name === col);
      let valueToSend = value;

      // Handle JSON parsing
      if (colDef?.data_type.includes('json')) {
          try {
              valueToSend = JSON.parse(value);
          } catch (e) {
              alert("Invalid JSON format");
              return; // Stay in edit mode
          }
      }

      // Only update if value changed (compare stringified for objects/json)
      const originalRow = data.find(r => getRowId(r) === rowId);
      const originalValue = originalRow[col];
      
      let isChanged = false;
      if (colDef?.data_type.includes('json')) {
          // Compare stringified versions for JSON
           if (JSON.stringify(originalValue) !== JSON.stringify(valueToSend)) {
               isChanged = true;
           }
      } else if (originalValue !== valueToSend) {
          isChanged = true;
      }

      if (!isChanged) {
          setEditingCell(null);
          return;
      }

      const updateData = { [col]: valueToSend };
      
      const result = await updateRecord(schema, table, identifier, updateData);
      
      if (result.success) {
          setEditingCell(null);
          router.refresh();
      } else {
          // Show error toast or alert?
          alert(`Failed to update: ${result.error}`);
          // Don't close edit mode so user can fix
      }
  }



  const renderCellContent = (row: any, col: string, rowId: string) => {
      const isEditingThisCell = editingCell?.rowId === rowId && editingCell?.col === col;
      const colDef = columnDefs.find(c => c.column_name === col);
      const inputType = colDef ? getInputType(colDef.data_type) : 'text';
      const value = row[col];

      if (isEditingThisCell) {
          return (
              <CellEditor
                  value={editingCell.value}
                  inputType={inputType}
                  onSave={(val) => saveCellValue(rowId, col, val)}
                  onCancel={() => setEditingCell(null)}
              />
          )
      }

      let displayValue = value;
      if (typeof value === 'object' && value !== null) {
          displayValue = JSON.stringify(value);
      }

      return (
          <div 
            className="w-full h-full min-h-[20px] cursor-default px-4 py-2 max-w-[300px] truncate"
            title={displayValue?.toString()}
          >
            {displayValue?.toString() ?? <span className="text-muted-foreground italic text-xs">null</span>}
          </div>
      )
  }

  const handleSort = (col: string) => {
      const currentSearchParams = new URLSearchParams(window.location.search);
      
      let newOrder = 'asc';
      if (sortCol === col && sortOrder === 'asc') {
          newOrder = 'desc';
      } else if (sortCol === col && sortOrder === 'desc') {
          // Remove sort
          currentSearchParams.delete('sort_col');
          currentSearchParams.delete('sort_order');
          router.push(`?${currentSearchParams.toString()}`);
          return;
      }

      currentSearchParams.set('sort_col', col);
      currentSearchParams.set('sort_order', newOrder);
      router.push(`?${currentSearchParams.toString()}`);
  }

  const isAllSelected = data.length > 0 && selectedRows.size === data.length;

  if (data.length === 0) {
    return <div className="p-4 text-muted-foreground text-sm">No data found in this table.</div>;
  }

  return (
    <div className="flex flex-col h-full">
        {/* Action Bar */}
        {selectedRows.size > 0 && (
            <div className="bg-primary/10 p-2 px-4 flex items-center justify-between border-b">
                <span className="text-sm font-medium text-primary">
                    {selectedRows.size} selected
                </span>
                <div className="flex gap-2">
                    {selectedRows.size === 1 && (
                        <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleEditClick}>
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                        </Button>
                    )}
                    
                    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="h-8 gap-2" disabled={isDeleting}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete {selectedRows.size} record{selectedRows.size > 1 ? 's' : ''} from the database.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isDeleting ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedRows(new Set())}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}

      <div className="flex-1 overflow-auto">
      <table className="w-full caption-bottom text-sm">
        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
          <TableRow className="border-b">
            <TableHead className="w-[50px] min-w-[50px] border-r bg-muted/20 text-center p-0 align-middle">
              <div className="flex justify-center items-center w-full h-full">
                <Checkbox 
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                />
              </div>
            </TableHead>
            {columns.map((col) => (
              <TableHead 
                key={col} 
                className="group h-10 border-r last:border-r-0 font-semibold bg-muted/20 whitespace-nowrap px-4 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                onClick={() => handleSort(col)}
              >
                <div className="flex items-center gap-1">
                    <span>{col}</span>
                    {primaryKey.includes(col) && <span className="text-xs text-primary">(PK)</span>}
                    
                    {sortCol === col ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
                    ) : (
                         <ArrowUpDown className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                    )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => {
            const rowId = getRowId(row);
            const isSelected = selectedRows.has(rowId);
            
            return (
                <TableRow key={i} className={`hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}>
                <TableCell className="border-r w-[50px] min-w-[50px] text-center p-0 align-middle">
                    <div className="flex justify-center items-center w-full h-full">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                        />
                    </div>
                </TableCell>
                {columns.map((col) => {
                    const isCellSelected = selectedCell?.rowId === rowId && selectedCell?.col === col;
                    return (
                        <TableCell 
                            key={`${i}-${col}`} 
                            className={`border-r last:border-r-0 whitespace-nowrap p-0 relative ${isCellSelected ? 'ring-2 ring-inset ring-primary z-[5]' : ''}`}
                            onMouseDownCapture={() => setSelectedCell({ rowId, col })}
                            onDoubleClick={() => handleCellDoubleClick(rowId, col, row[col])}
                        >
                            {renderCellContent(row, col, rowId)}
                        </TableCell>
                    )
                })}
                </TableRow>
            )
          })}
        </TableBody>
      </table>
      </div>

      {/* Edit Sheet */}
      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
            <SheetHeader>
                <SheetTitle>Edit Record</SheetTitle>
                <SheetDescription>Update values for the selected record.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
                {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                        {error}
                    </div>
                )}
                {columnDefs.map(col => {
                     const inputType = getInputType(col.data_type)
                     return (
                        <div key={col.column_name} className="space-y-2">
                          <Label htmlFor={`edit-${col.column_name}`} className="flex items-center gap-2">
                            {col.column_name}
                            {primaryKey.includes(col.column_name) && <span className="text-xs text-primary">(PK)</span>}
                          </Label>
                          {inputType === 'boolean' ? (
                               <Select
                                   value={editData[col.column_name] === true ? "true" : "false"}
                                   onValueChange={(val) => setEditData(prev => ({ ...prev, [col.column_name]: val === 'true' }))}
                               >
                                   <SelectTrigger id={`edit-${col.column_name}`}>
                                       <SelectValue placeholder="Select..." />
                                   </SelectTrigger>
                                   <SelectContent>
                                       <SelectItem value="true">True</SelectItem>
                                       <SelectItem value="false">False</SelectItem>
                                   </SelectContent>
                               </Select>
                           ) : (
                               <Input
                                 id={`edit-${col.column_name}`}
                                 type={inputType === 'json' ? 'text' : inputType}
                                 value={
                                     inputType === 'json' && typeof editData[col.column_name] === 'object' 
                                        ? JSON.stringify(editData[col.column_name]) 
                                        : (editData[col.column_name] || '')
                                 }
                                 onChange={(e) => {
                                     let val = e.target.value;
                                     if (inputType === 'json') {
                                         // For now just keep as string, we might need to parse on submit if we want to send object
                                         // But updateRecord handles it? 
                                         // Actually updateRecord takes `editData`. 
                                         // If we store string in editData, updateRecord sends string.
                                         // Let's just store the string value in editData for now?
                                         // Wait, if editData[col] becomes string, then JSON.stringify(editData[col]) will double escape on next render if we are not careful.
                                         // But `value` prop handles that.
                                         // If we change it to string, `typeof` is string, so it goes to `editData[col.column_name]`.
                                         // So it's fine.
                                         // But on submit, we might want to parse it?
                                         // Let's just set the value as is.
                                     }
                                     setEditData(prev => ({ ...prev, [col.column_name]: val }))
                                 }}
                               />
                           )}
                        </div>
                     )
                })}
                <SheetFooter>
                    <Button type="submit" disabled={isSubmitting}>
                        Save Changes
                    </Button>
                </SheetFooter>
            </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
