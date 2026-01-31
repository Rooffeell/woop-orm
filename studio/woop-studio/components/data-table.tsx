"use client"

import { useState, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Trash2, Edit, X } from "lucide-react"
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

interface DataTableProps {
  data: any[]
  columns: string[]
  primaryKey: string[]
  schema: string
  table: string
  columnDefs: any[]
}

export function DataTable({ data, columns, primaryKey, schema, table, columnDefs }: DataTableProps) {
  const router = useRouter()
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Reset selection when data changes (e.g. table switch)
  useEffect(() => {
    setSelectedRows(new Set())
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

    // Prepare data to update (exclude PKs usually, but let's allow updating everything for now unless it's serial)
    // Actually, updating PKs is tricky. Let's assume we update non-PKs, or everything.
    // If we update PK, the identifier changes.
    
    const result = await updateRecord(schema, table, identifier, editData);
    
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
    if (dataType.includes('bool')) return 'checkbox'
    return 'text'
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
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
          <TableRow className="border-b">
            <TableHead className="w-[50px] border-r bg-muted/20 text-center p-0 align-middle">
              <div className="flex justify-center items-center w-full h-full">
                <Checkbox 
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                />
              </div>
            </TableHead>
            {columns.map((col) => (
              <TableHead key={col} className="h-10 border-r last:border-r-0 font-semibold bg-muted/20">
                {col}
                {primaryKey.includes(col) && <span className="ml-1 text-xs text-primary">(PK)</span>}
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
                <TableCell className="border-r w-[50px] text-center p-0 align-middle">
                    <div className="flex justify-center items-center w-full h-full">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                        />
                    </div>
                </TableCell>
                {columns.map((col) => (
                    <TableCell key={`${i}-${col}`} className="border-r last:border-r-0 py-2 whitespace-nowrap">
                    {row[col]?.toString() ?? <span className="text-muted-foreground italic text-xs">null</span>}
                    </TableCell>
                ))}
                </TableRow>
            )
          })}
        </TableBody>
      </Table>
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
                          {inputType === 'checkbox' ? (
                               <div className="flex items-center gap-2">
                                   <input 
                                     type="checkbox" 
                                     id={`edit-${col.column_name}`}
                                     checked={editData[col.column_name] === true}
                                     onChange={(e) => setEditData(prev => ({ ...prev, [col.column_name]: e.target.checked }))}
                                     className="h-4 w-4"
                                   />
                                   <span className="text-sm text-muted-foreground">True</span>
                               </div>
                           ) : (
                               <Input
                                 id={`edit-${col.column_name}`}
                                 type={inputType}
                                 value={editData[col.column_name] || ''}
                                 onChange={(e) => setEditData(prev => ({ ...prev, [col.column_name]: e.target.value }))}
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
