import { create } from "zustand"

interface POSheetState {
  poId: string | null
  open: (id: string) => void
  close: () => void
}

/**
 * Global store for the slide-in Purchase Order detail sheet, mirroring
 * `useVendorSheet`. Mounted once in App.tsx; opened from any PO list
 * row or wherever a PO id is rendered.
 */
export const usePOSheet = create<POSheetState>((set) => ({
  poId: null,
  open: (id) => set({ poId: id }),
  close: () => set({ poId: null }),
}))
