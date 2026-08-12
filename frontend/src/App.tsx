import { useMemo } from "react"
import { Routes, Route, useLocation, useNavigate } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { CommandPalette } from "@/components/layout/CommandPalette"
import {
  ShortcutsOverlay,
  useShortcutsOverlay,
} from "@/components/layout/ShortcutsOverlay"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"
import { PageLoadingBar } from "@/components/shared/PageLoadingBar"
import { POSheet } from "@/components/shared/POSheet"
import { ReceiptSheet } from "@/components/shared/ReceiptSheet"
import { VendorSheet } from "@/components/shared/VendorSheet"
import { ROUTES } from "@/lib/routes"
import { useTheme } from "@/hooks/useTheme"
import { useInvoiceNotifications } from "@/hooks/useInvoiceNotifications"
import { useShortcuts, type Shortcut } from "@/hooks/useShortcuts"

import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { InboxPage } from "@/pages/InboxPage"
import { InvoiceDetailPage } from "@/pages/InvoiceDetailPage"
import { CompareViewPage } from "@/pages/CompareViewPage"
import { PipelinePage } from "@/pages/PipelinePage"
import { FlowPage } from "@/pages/FlowPage"
import { ExceptionsPage } from "@/pages/ExceptionsPage"
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage"
import { DeliveryReceiptsPage } from "@/pages/DeliveryReceiptsPage"
import { VendorsPage } from "@/pages/VendorsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

export default function App() {
  useTheme() // initialize theme
  useInvoiceNotifications() // global cross-page notification dispatcher
  useGlobalShortcuts()

  const location = useLocation()

  // Two layers of error containment:
  //   * The outer boundary in main.tsx catches catastrophic provider /
  //     bootstrap errors -- it persists across navigation.
  //   * This inner boundary is keyed by route path so a page-level crash
  //     resets the moment the user navigates somewhere else, instead of
  //     leaving them stuck on the fallback screen forever.
  //
  // Note on AnimatePresence: an earlier revision wrapped these routes in
  // <AnimatePresence mode="wait"> for page exit animations. None of the
  // pages actually define an `exit` prop, though, so the wait mode would
  // hang indefinitely waiting for an exit that never fires -- the
  // observable symptom was the URL changing to e.g. /invoices while the
  // previous page (Vendors) stayed mounted. Removed.
  return (
    <>
      <PageLoadingBar />
      <CommandPalette />
      <ShortcutsOverlay />
      <VendorSheet />
      <POSheet />
      <ReceiptSheet />
      <ErrorBoundary key={location.pathname}>
        <Routes location={location}>
          <Route path={ROUTES.landing} element={<LandingPage />} />
          <Route path={ROUTES.login} element={<LoginPage />} />

          <Route element={<RequireAuth />}>
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
              <Route
                path={ROUTES.deliveryReceipts}
                element={<DeliveryReceiptsPage />}
              />
              <Route path={ROUTES.vendors} element={<VendorsPage />} />
              <Route path={ROUTES.settings} element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </>
  )
}

/**
 * Wires all global keyboard shortcuts:
 *   ? -- open shortcuts overlay
 *   g d -- dashboard, g i -- inbox, g e -- exceptions,
 *   g p -- purchase orders, g r -- delivery receipts, g l -- pipeline, g f -- 3D flow, g s -- settings
 *   n -- new upload (jump to inbox)
 */
function useGlobalShortcuts() {
  const navigate = useNavigate()
  const toggleOverlay = useShortcutsOverlay((s) => s.toggle)

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        keys: "?",
        description: "Show keyboard shortcuts",
        category: "Help",
        handler: () => toggleOverlay(),
      },
      {
        keys: "g d",
        description: "Go to Dashboard",
        category: "Navigation",
        handler: () => navigate(ROUTES.dashboard),
      },
      {
        keys: "g i",
        description: "Go to Inbox",
        category: "Navigation",
        handler: () => navigate(ROUTES.inbox),
      },
      {
        keys: "g e",
        description: "Go to Exceptions",
        category: "Navigation",
        handler: () => navigate(ROUTES.exceptions),
      },
      {
        keys: "g p",
        description: "Go to Purchase Orders",
        category: "Navigation",
        handler: () => navigate(ROUTES.purchaseOrders),
      },
      {
        keys: "g r",
        description: "Go to Delivery Receipts",
        category: "Navigation",
        handler: () => navigate(ROUTES.deliveryReceipts),
      },
      {
        keys: "g v",
        description: "Go to Vendors",
        category: "Navigation",
        handler: () => navigate(ROUTES.vendors),
      },
      {
        keys: "g l",
        description: "Go to Pipeline",
        category: "Navigation",
        handler: () => navigate(ROUTES.pipeline),
      },
      {
        keys: "g f",
        description: "Go to 3D Flow",
        category: "Navigation",
        handler: () => navigate(ROUTES.flow),
      },
      {
        keys: "g s",
        description: "Go to Settings",
        category: "Navigation",
        handler: () => navigate(ROUTES.settings),
      },
      {
        keys: "n",
        description: "New invoice (upload)",
        category: "Actions",
        handler: () => navigate(ROUTES.inbox),
      },
    ],
    [navigate, toggleOverlay]
  )

  useShortcuts(shortcuts)
}
