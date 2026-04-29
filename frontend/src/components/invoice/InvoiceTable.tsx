import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, FileText } from "lucide-react"

import type { InvoiceListItem } from "@/api/types"
import { ProcessingStatusBadge } from "./ProcessingStatusBadge"
import { BusinessStatusBadge } from "./BusinessStatusBadge"
import { formatCurrency, formatRelative, shortId } from "@/lib/format"

interface Props {
  invoices: InvoiceListItem[]
}

export function InvoiceTable({ invoices }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30">
            <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <th className="px-5 py-3">Invoice</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Processing</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Uploaded</th>
              <th className="px-5 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {invoices.map((inv, i) => (
              <motion.tr
                key={inv.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="group hover:bg-accent/30 transition-colors"
              >
                <td className="px-5 py-3.5">
                  <Link
                    to={`/invoices/${inv.id}`}
                    className="flex items-center gap-3"
                  >
                    <div className="size-9 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center shrink-0 group-hover:border-primary/40 transition-colors">
                      <FileText className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {inv.invoice_number ?? "Pending parse…"}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {shortId(inv.id)}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-3.5 font-mono tabular-nums">
                  {formatCurrency(inv.total_amount)}
                </td>
                <td className="px-5 py-3.5">
                  <ProcessingStatusBadge status={inv.processing_status} />
                </td>
                <td className="px-5 py-3.5">
                  <BusinessStatusBadge status={inv.business_status} />
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {formatRelative(inv.created_at)}
                </td>
                <td className="px-5 py-3.5">
                  <Link
                    to={`/invoices/${inv.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center size-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
