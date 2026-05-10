export const ROUTES = {
  landing: "/",
  dashboard: "/dashboard",
  inbox: "/invoices",
  invoiceDetail: (id: string) => `/invoices/${id}`,
  compareView: (id: string) => `/invoices/${id}/compare`,
  exceptions: "/exceptions",
  purchaseOrders: "/purchase-orders",
  vendors: "/vendors",
  pipeline: "/pipeline",
  flow: "/flow",
  settings: "/settings",
} as const
