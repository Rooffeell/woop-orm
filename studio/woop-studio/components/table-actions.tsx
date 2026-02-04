"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Loader2, RefreshCw, Plus, Filter, Trash2, PlusCircle } from "lucide-react"

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
  const [filters, setFilters] = useState<Array<{ col: string, op: string, val: string }>>([])

  // Initialize filter state from URL
  useEffect(() => {
    const filtersParam = searchParams.get('filters');
    const legacyFilterCol = searchParams.get('filter_col');
    
    if (filtersParam) {
        try {
            const parsed = JSON.parse(filtersParam);
            if (Array.isArray(parsed)) {
                setFilters(parsed);
                return;
            }
        } catch {}
    }

    if (legacyFilterCol) {
        setFilters([{
            col: searchParams.get('filter_col') || "",
            op: searchParams.get('filter_op') || "eq",
            val: searchParams.get('filter_val') || ""
        }])
    } else if (!filtersParam) {
        setFilters([])
    }
  }, [searchParams])

  const handleRefresh = () => {
    router.refresh()
  }

  const handleApplyFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    
    // Clear legacy params
    params.delete('filter_col')
    params.delete('filter_op')
    params.delete('filter_val')
    
    const validFilters = filters.filter(f => f.col && f.val);

    if (validFilters.length > 0) {
      params.set('filters', JSON.stringify(validFilters))
      params.set('page', '1') // Reset page
    } else {
      params.delete('filters')
    }

    router.replace(`${pathname}?${params.toString()}`)
    setIsFilterOpen(false)
  }

  const handleClearFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('filter_col')
    params.delete('filter_op')
    params.delete('filter_val')
    params.delete('filters')
    params.set('page', '1')
    
    setFilters([])
    
    router.replace(`${pathname}?${params.toString()}`)
    setIsFilterOpen(false)
  }

  const addFilter = () => {
      setFilters([...filters, { col: "", op: "eq", val: "" }])
  }

  const removeFilter = (index: number) => {
      const newFilters = [...filters]
      newFilters.splice(index, 1)
      setFilters(newFilters)
  }

  const updateFilter = (index: number, field: 'col' | 'op' | 'val', value: string) => {
      const newFilters = [...filters]
      newFilters[index] = { ...newFilters[index], [field]: value }
      setFilters(newFilters)
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
          <Button variant="outline" size="sm" className="h-8 gap-2 relative">
            <Filter className="h-3.5 w-3.5" />
            Filter
            {filters.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1 h-5 min-w-[20px] flex items-center justify-center text-[10px]">
                    {filters.length}
                </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto sm:max-w-md w-[500px]">
          <SheetHeader>
            <SheetTitle>Filter Table</SheetTitle>
            <SheetDescription>
              Filter records in {table}.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 py-4">
            {filters.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                    No filters applied. Click "Add Filter" to start.
                </div>
            )}
            
            {filters.map((filter, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 border rounded-md relative bg-muted/20">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute top-1 right-1 h-6 w-6 p-0 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFilter(index)}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                    
                    <div className="grid gap-2">
                        <Label className="text-xs">Column</Label>
                        <Select value={filter.col} onValueChange={(val) => updateFilter(index, 'col', val)}>
                            <SelectTrigger className="h-8">
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

                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-2">
                            <Label className="text-xs">Operator</Label>
                            <Select value={filter.op} onValueChange={(val) => updateFilter(index, 'op', val)}>
                                <SelectTrigger className="h-8">
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
                            <Label className="text-xs">Value</Label>
                            <Input
                                value={filter.val}
                                onChange={(e) => updateFilter(index, 'val', e.target.value)}
                                placeholder="Value..."
                                className="h-8"
                            />
                        </div>
                    </div>
                </div>
            ))}

            <Button variant="outline" size="sm" onClick={addFilter} className="gap-2 border-dashed">
                <PlusCircle className="h-3.5 w-3.5" />
                Add Filter
            </Button>

            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button onClick={handleApplyFilter} className="flex-1">Apply Filters</Button>
              <Button variant="outline" onClick={handleClearFilter} className="flex-1">Clear All</Button>
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
