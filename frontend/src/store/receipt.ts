import { create } from "zustand"

interface ReceiptSheetState {
  receiptId: string | null
  open: (id: string) => void
  close: () => void
}

/**
 * Global store for the slide-in delivery receipt sheet, mirroring
 * `usePOSheet`. Mounted once in App.tsx.
 */
export const useReceiptSheet = create<ReceiptSheetState>((set) => ({
  receiptId: null,
  open: (id) => set({ receiptId: id }),
  close: () => set({ receiptId: null }),
}))
