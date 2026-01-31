"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { insertRecord } from "@/app/actions"
import { Loader2, RefreshCw, Plus } from "lucide-react"

interface ColumnDef {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface TableActionsProps {
  schema: string
  table: string
  columns: ColumnDef[]
}

export function TableActions({ schema, table, columns }: TableActionsProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = () => {
    router.refresh()
  }

  const handleInputChange = (colName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [colName]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Filter out empty strings if column is nullable or has default
    const dataToSubmit: Record<string, any> = {}
    
    columns.forEach(col => {
        const val = formData[col.column_name];
        if (val !== undefined && val !== "") {
            dataToSubmit[col.column_name] = val;
        }
    });

    const result = await insertRecord(schema, table, dataToSubmit)

    setIsSubmitting(false)

    if (result.success) {
      setIsOpen(false)
      setFormData({})
      router.refresh()
    } else {
      setError(result.error || "Failed to insert record")
    }
  }

  const getInputType = (dataType: string) => {
    if (dataType.includes('int') || dataType.includes('numeric') || dataType.includes('float') || dataType.includes('double')) return 'number'
    if (dataType.includes('date')) return 'date'
    if (dataType.includes('timestamp')) return 'datetime-local'
    if (dataType.includes('bool')) return 'checkbox'
    return 'text'
  }

  // Filter out auto-generated columns usually (like serial id), but for now show all
  // Usually we might want to skip columns with defaults if they are not nullable, but let's just show all
  
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleRefresh}>
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button size="sm" className="h-8 gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add Record
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add New Record</SheetTitle>
            <SheetDescription>
              Create a new entry in {table}.
            </SheetDescription>
          </SheetHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                    {error}
                </div>
            )}
            
            {columns.map((col) => {
              const inputType = getInputType(col.data_type)
              
              // Skip if it looks like an auto-incrementing ID (integer + default value nextval)
              // But strictly speaking we should allow overriding it.
              // Let's just render everything for maximum flexibility as requested ("knows the data types")
              
              return (
                <div key={col.column_name} className="space-y-2">
                  <Label htmlFor={col.column_name} className="flex items-center gap-2">
                    {col.column_name}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({col.data_type})
                      {col.is_nullable === 'NO' && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </Label>
                  {inputType === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id={col.column_name}
                            checked={formData[col.column_name] === true}
                            onChange={(e) => setFormData(prev => ({ ...prev, [col.column_name]: e.target.checked }))}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-muted-foreground">True</span>
                      </div>
                  ) : (
                      <Input
                        id={col.column_name}
                        type={inputType}
                        placeholder={col.column_default ? `Default: ${col.column_default}` : ''}
                        value={formData[col.column_name] || ''}
                        onChange={(e) => handleInputChange(col.column_name, e.target.value)}
                        required={col.is_nullable === 'NO' && !col.column_default}
                      />
                  )}
                </div>
              )
            })}

            <SheetFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Record
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
