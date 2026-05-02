import { useParams, Link } from "react-router-dom"
import { ArrowLeft, GitCompare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageSkeleton } from "@/components/shared/LoadingSkeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { NoData } from "@/components/shared/illustrations/NoData"
import { NoMatches } from "@/components/shared/illustrations/NoMatches"
import { DocumentCompare } from "@/components/compare/DocumentCompare"
import { useInvoice, useInvoiceReconciliation } from "@/api/invoices"
import { ROUTES } from "@/lib/routes"

export function CompareViewPage() {
  const { id } = useParams<{ id: string }>()
  const { data: invoice, isLoading } = useInvoice(id)
  const { data: recon, isLoading: reconLoading } = useInvoiceReconciliation(id)

  if (isLoading || reconLoading) {
    return <PageSkeleton />
  }

  if (!invoice) {
    return (
      <Card>
        <EmptyState
          illustration={<NoData className="w-full" />}
          title="Invoice not found"
          description="This invoice may have been deleted"
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Link to={ROUTES.invoiceDetail(invoice.id)}>
        <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
          <ArrowLeft className="size-4" />
          Back to invoice
        </Button>
      </Link>

      {!recon ? (
        <Card>
          <EmptyState
            illustration={<NoMatches className="w-full" />}
            title="No reconciliation yet"
            description="Comparison view becomes available after the agent pipeline completes"
          />
        </Card>
      ) : (
        <DocumentCompare invoice={invoice} reconciliation={recon} />
      )}
    </div>
  )
}
