import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

interface PaginationControlsProps {
  currentPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
  baseUrl: string
  searchParams: Record<string, string | undefined>
}

export function PaginationControls({ 
  currentPage, 
  hasNextPage, 
  hasPrevPage,
  baseUrl,
  searchParams
}: PaginationControlsProps) {
  
  const createPageUrl = (page: number) => {
    const params = new URLSearchParams()
    // Copy existing params
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    // Set page
    params.set('page', page.toString())
    return `${baseUrl}?${params.toString()}`
  }

  return (
    <div className="flex items-center justify-end space-x-2 py-2 px-4 border-t bg-background">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPrevPage}
        asChild={hasPrevPage}
      >
        {hasPrevPage ? (
          <Link href={createPageUrl(currentPage - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Link>
        ) : (
          <span className="flex items-center cursor-not-allowed opacity-50">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </span>
        )}
      </Button>
      <div className="text-sm font-medium mx-2">
        Page {currentPage}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasNextPage}
        asChild={hasNextPage}
      >
        {hasNextPage ? (
          <Link href={createPageUrl(currentPage + 1)}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        ) : (
           <span className="flex items-center cursor-not-allowed opacity-50">
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </span>
        )}
      </Button>
    </div>
  )
}
