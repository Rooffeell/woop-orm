"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Loader2, RefreshCw, Plus, Filter } from "lucide-react"

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
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filterCol, setFilterCol] = useState("")
  const [filterOp, setFilterOp] = useState("eq")
  const [filterVal, setFilterVal] = useState("")

  // Initialize filter state from URL
  useEffect(() => {
    setFilterCol(searchParams.get('filter_col') || "")
    setFilterOp(searchParams.get('filter_op') || "eq")
    setFilterVal(searchParams.get('filter_val') || "")
  }, [searchParams])

  const handleRefresh = () => {
    router.refresh()
  }

  const handleApplyFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (filterCol && filterVal) {
      params.set('filter_col', filterCol)
      params.set('filter_op', filterOp)
      params.set('filter_val', filterVal)
      params.set('page', '1') // Reset page
    }
    router.replace(`${pathname}?${params.toString()}`)
    setIsFilterOpen(false)
  }

  const handleClearFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('filter_col')
    params.delete('filter_op')
    params.delete('filter_val')
    params.set('page', '1')
    
    setFilterCol("")
    setFilterOp("eq")
    setFilterVal("")
    
    router.replace(`${pathname}?${params.toString()}`)
    setIsFilterOpen(false)
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

  return (
    <div className="flex gap-2">
      <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filter Table</SheetTitle>
            <SheetDescription>
              Filter records in {table}.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="column">Column</Label>
              <Select value={filterCol} onValueChange={setFilterCol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.column_name} value={col.column_name}>
                      {col.column_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="operator">Operator</Label>
              <Select value={filterOp} onValueChange={setFilterOp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">Equals (=)</SelectItem>
                  <SelectItem value="neq">Not Equals (!=)</SelectItem>
                  <SelectItem value="gt">Greater Than (&gt;)</SelectItem>
                  <SelectItem value="gte">Greater Than or Equal (&gt;=)</SelectItem>
                  <SelectItem value="lt">Less Than (&lt;)</SelectItem>
                  <SelectItem value="lte">Less Than or Equal (&lt;=)</SelectItem>
                  <SelectItem value="like">Like (Contains)</SelectItem>
                  <SelectItem value="ilike">ILike (Case Insensitive)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
                placeholder="Value to filter by..."
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleApplyFilter} className="flex-1">Apply Filter</Button>
              <Button variant="outline" onClick={handleClearFilter} className="flex-1">Clear</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
