import { motion } from "framer-motion"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/EmptyState"
import { Sparkles } from "lucide-react"

interface Props {
  discrepancies: Record<string, number>
}

const LABELS: Record<string, string> = {
  duplicate_invoice: "Duplicate Invoice",
  price_deviation: "Price Deviation",
  quantity_mismatch: "Quantity Mismatch",
  missing_po: "Missing PO",
  missing_receipt: "Missing Receipt",
  date_anomaly: "Date Anomaly",
  amount_exceeds_po: "Amount Exceeds PO",
  unauthorized_vendor: "Unauthorized Vendor",
}

export function TopDiscrepanciesChart({ discrepancies }: Props) {
  const entries = Object.entries(discrepancies).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] ?? 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Discrepancy Types</CardTitle>
        <CardDescription>
          Most common reasons invoices need human review
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No discrepancies yet"
            description="Process invoices to see discrepancy patterns"
          />
        ) : (
          <div className="space-y-3">
            {entries.map(([type, count], i) => {
              const pct = (count / max) * 100
              return (
                <div key={type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {LABELS[type] ?? type}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        delay: i * 0.06,
                        duration: 0.7,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
