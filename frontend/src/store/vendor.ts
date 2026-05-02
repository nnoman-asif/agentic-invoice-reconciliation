import { create } from "zustand"

interface VendorSheetState {
  vendorId: string | null
  open: (id: string) => void
  close: () => void
}

export const useVendorSheet = create<VendorSheetState>((set) => ({
  vendorId: null,
  open: (id) => set({ vendorId: id }),
  close: () => set({ vendorId: null }),
}))
