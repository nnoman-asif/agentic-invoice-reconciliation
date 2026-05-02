import { Routes, Route } from "react-router-dom"
import { AnimatePresence } from "framer-motion"

import { AppShell } from "@/components/layout/AppShell"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"
import { PageLoadingBar } from "@/components/shared/PageLoadingBar"
import { ROUTES } from "@/lib/routes"
import { useTheme } from "@/hooks/useTheme"
import { useInvoiceNotifications } from "@/hooks/useInvoiceNotifications"

import { LandingPage } from "@/pages/LandingPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { InboxPage } from "@/pages/InboxPage"
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage"
import { CompareViewPage } from "@/pages/CompareViewPage"
import { PipelinePage } from "@/pages/PipelinePage"
import { FlowPage } from "@/pages/FlowPage"
import { ExceptionsPage } from "@/pages/ExceptionsPage"
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

export default function App() {
  useTheme() // initialize theme
  useInvoiceNotifications() // global cross-page notification dispatcher

  return (
    <ErrorBoundary>
      <PageLoadingBar />
      <CommandPalette />
      <AnimatePresence mode="wait">
        <Routes>
          <Route path={ROUTES.landing} element={<LandingPage />} />

          <Route element={<AppShell />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.inbox} element={<InboxPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route
              path="/invoices/:id/compare"
              element={<CompareViewPage />}
            />
            <Route path={ROUTES.pipeline} element={<PipelinePage />} />
            <Route path={ROUTES.flow} element={<FlowPage />} />
            <Route path={ROUTES.exceptions} element={<ExceptionsPage />} />
            <Route
              path={ROUTES.purchaseOrders}
              element={<PurchaseOrdersPage />}
            />
            <Route path={ROUTES.settings} element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
    </ErrorBoundary>
  )
}
