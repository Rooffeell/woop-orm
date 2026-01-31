"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function SchemaSelector({ schemas, currentSchema }: { schemas: string[], currentSchema: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("schema", value)
    params.delete("table") // Reset table selection when schema changes
    router.push(`/?${params.toString()}`)
  }

  return (
    <Select value={currentSchema} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-green-500" />
           <SelectValue placeholder="Choose schema" />
        </div>
      </SelectTrigger>
      <SelectContent position="popper">
        {schemas.map((schema) => (
          <SelectItem key={schema} value={schema}>
            {schema}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
