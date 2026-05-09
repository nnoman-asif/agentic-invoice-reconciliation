import { Building2 } from "lucide-react"

import { useVendor, useVendors } from "@/api/vendors"
import { useVendorSheet } from "@/store/vendor"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  vendorId: string | null | undefined
  className?: string
  variant?: "inline" | "row"
}

export function VendorBadge({ vendorId, className, variant = "inline" }: Props) {
  const open = useVendorSheet((s) => s.open)
  // Use list to avoid repeated single fetches
  const { data: vendors } = useVendors()
  const vendorFromList = vendorId
    ? vendors?.find((v) => v.id === vendorId)
    : undefined
  // Fallback to single fetch only if not in list
  const { data: vendorFallback } = useVendor(
    vendorId && !vendorFromList ? vendorId : null
  )
  const vendor = vendorFromList ?? vendorFallback

  if (!vendorId) {
    return (
      <span
        className={cn(
          "text-xs text-muted-foreground italic",
          className
        )}
      >
        Pending vendor…
      </span>
    )
  }

  if (!vendor) {
    return <Skeleton className={cn("h-5 w-20", className)} />
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        open(vendor.id)
      }}
      aria-label={`View vendor ${vendor.name}`}
      className={cn(
        "inline-flex items-center gap-1.5 group",
        variant === "row" ? "" : "max-w-full",
        className
      )}
    >
      <Building2 className="size-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
      <span className="text-sm group-hover:text-primary group-hover:underline underline-offset-2 truncate">
        {vendor.name}
      </span>
    </button>
  )
}
