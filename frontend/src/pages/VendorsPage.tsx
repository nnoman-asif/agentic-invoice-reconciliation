import { useState } from "react"
import { motion } from "framer-motion"
import { Building2, Mail, Plus, Search, ArrowRight } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { TableSkeleton } from "@/components/shared/LoadingSkeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { NoData } from "@/components/shared/illustrations/NoData"
import { ExportButton } from "@/components/shared/ExportButton"
import { ImportButton } from "@/components/shared/ImportButton"
import { VendorForm } from "@/components/vendor/VendorForm"
import {
  useImportVendorsCsv,
  useVendors,
  type Vendor,
} from "@/api/vendors"
import { useVendorSheet } from "@/store/vendor"
import { useAuthStore } from "@/store/auth"
import { AUTH_ENABLED } from "@/lib/firebase"
import type { CsvColumn } from "@/lib/csv"

const VENDOR_COLUMNS: CsvColumn<Vendor>[] = [
  { header: "ID", accessor: (v) => v.id },
  { header: "Code", accessor: (v) => v.code },
  { header: "Name", accessor: (v) => v.name },
  { header: "Tax ID", accessor: (v) => v.tax_id ?? "" },
  { header: "Address", accessor: (v) => v.address ?? "" },
  { header: "Contact Email", accessor: (v) => v.contact_email ?? "" },
  { header: "Created At", accessor: (v) => v.created_at },
]

export function VendorsPage() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const { data, isLoading } = useVendors()
  const openSheet = useVendorSheet((s) => s.open)
  const importMutation = useImportVendorsCsv()
  const canWrite = useAuthStore((s) => !AUTH_ENABLED || Boolean(s.firebaseUser))

  const filtered = data?.filter((v) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      v.name.toLowerCase().includes(s) ||
      v.code.toLowerCase().includes(s) ||
      (v.tax_id ?? "").toLowerCase().includes(s) ||
      (v.contact_email ?? "").toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vendors"
        description="The companies your invoices and purchase orders reference. The matcher agent looks vendors up by tax ID first, then by name. Vendors must exist before their POs or invoices can be reconciled."
        actions={
          <>
            {canWrite && (
              <ImportButton
                entity="vendors"
                templateUrl="/samples/vendors-template.csv"
                importMutation={importMutation}
              />
            )}
            <ExportButton
              data={data}
              columns={VENDOR_COLUMNS}
              filenamePrefix="vendors"
            />
            {canWrite && (
              <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                New vendor
              </Button>
            )}
          </>
        }
      />

      {canWrite && <VendorForm open={formOpen} onOpenChange={setFormOpen} />}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, code, tax ID, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<NoData className="w-full" />}
            title="No vendors"
            description={
              search
                ? "No vendors match your search."
                : "Run the seed script to load sample vendors, or import them via CSV."
            }
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-3">Vendor</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Tax ID</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((v, i) => (
                <motion.tr
                  key={v.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => openSheet(v.id)}
                  className="hover:bg-accent/30 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Building2 className="size-4 text-blue-500" />
                      </div>
                      <span className="font-medium">{v.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                    {v.code}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                    {v.tax_id ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {v.contact_email ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <Mail className="size-3" />
                        {v.contact_email}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
