import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { isAxiosError } from "axios"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import {
  useCreatePO,
  usePurchaseOrder,
  useUpdatePO,
} from "@/api/purchase-orders"
import { useVendors } from "@/api/vendors"
import { formatCurrency } from "@/lib/format"

interface POFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, dialog is in Edit mode and pre-fills from this PO id. */
  poId?: string | null
  onSaved?: (poId: string) => void
}

interface LineItemDraft {
  /** Stable client-side key for the React list. */
  key: string
  line_number: number
  item_code: string
  item_description: string
  quantity: string
  unit_price: string
  unit_of_measure: string
}

interface FormState {
  po_number: string
  vendor_id: string
  issue_date: string
  expected_delivery_date: string
  status: string
  currency: string
  notes: string
  line_items: LineItemDraft[]
}

interface FormErrors {
  po_number?: string
  vendor_id?: string
  issue_date?: string
  line_items?: string
  perLine?: Array<Partial<Record<
    "line_number" | "item_description" | "quantity" | "unit_price",
    string
  >>>
}

const today = () => new Date().toISOString().slice(0, 10)

const blankLine = (line_number: number): LineItemDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  line_number,
  item_code: "",
  item_description: "",
  quantity: "",
  unit_price: "",
  unit_of_measure: "",
})

const emptyForm = (): FormState => ({
  po_number: "",
  vendor_id: "",
  issue_date: today(),
  expected_delivery_date: "",
  status: "issued",
  currency: "USD",
  notes: "",
  line_items: [blankLine(1)],
})

export function POForm({ open, onOpenChange, poId, onSaved }: POFormProps) {
  const isEdit = !!poId
  const { data: existingPO } = usePurchaseOrder(isEdit ? poId : null)
  const { data: vendors } = useVendors()
  const createMutation = useCreatePO()
  const updateMutation = useUpdatePO()
  const pending = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})

  // Reset/sync when dialog opens or the loaded PO arrives.
  useEffect(() => {
    if (!open) return
    if (isEdit && existingPO) {
      setForm({
        po_number: existingPO.po_number,
        vendor_id: existingPO.vendor_id,
        issue_date: existingPO.issue_date,
        expected_delivery_date: existingPO.expected_delivery_date ?? "",
        status: existingPO.status,
        currency: existingPO.currency,
        notes: existingPO.notes ?? "",
        line_items: existingPO.line_items
          .slice()
          .sort((a, b) => a.line_number - b.line_number)
          .map((li) => ({
            key: li.id,
            line_number: li.line_number,
            item_code: li.item_code ?? "",
            item_description: li.item_description,
            quantity: String(li.quantity),
            unit_price: String(li.unit_price),
            unit_of_measure: li.unit_of_measure ?? "",
          })),
      })
      setErrors({})
    } else if (!isEdit) {
      setForm(emptyForm())
      setErrors({})
    }
  }, [open, isEdit, existingPO])

  const vendorOptions: ComboboxOption[] = useMemo(
    () =>
      (vendors ?? []).map((v) => ({
        value: v.id,
        label: v.name,
        hint: v.code,
        keywords: [v.code, v.tax_id ?? ""],
      })),
    [vendors]
  )

  const livePerLineTotals = form.line_items.map((li) => {
    const q = Number(li.quantity)
    const p = Number(li.unit_price)
    return Number.isFinite(q) && Number.isFinite(p) ? q * p : 0
  })
  const liveTotal = livePerLineTotals.reduce((a, b) => a + b, 0)

  const updateField = <K extends keyof Omit<FormState, "line_items">>(
    key: K,
    value: string
  ) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key as keyof FormErrors]) {
      setErrors((e) => ({ ...e, [key]: undefined }))
    }
  }

  const updateLine = <K extends keyof Omit<LineItemDraft, "key">>(
    idx: number,
    key: K,
    value: LineItemDraft[K]
  ) => {
    setForm((f) => ({
      ...f,
      line_items: f.line_items.map((li, i) =>
        i === idx ? { ...li, [key]: value } : li
      ),
    }))
  }

  const addLine = () => {
    setForm((f) => {
      const nextNumber =
        f.line_items.reduce((m, li) => Math.max(m, li.line_number), 0) + 1
      return { ...f, line_items: [...f.line_items, blankLine(nextNumber)] }
    })
  }

  const removeLine = (idx: number) => {
    setForm((f) => ({
      ...f,
      line_items: f.line_items.filter((_, i) => i !== idx),
    }))
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!form.po_number.trim()) next.po_number = "Required"
    if (!form.vendor_id) next.vendor_id = "Required"
    if (!form.issue_date) next.issue_date = "Required"
    if (form.line_items.length === 0) next.line_items = "Add at least one line"
    const seenLineNumbers = new Set<number>()
    const perLine = form.line_items.map((li) => {
      const lineErr: NonNullable<FormErrors["perLine"]>[number] = {}
      if (!Number.isInteger(li.line_number) || li.line_number < 1) {
        lineErr.line_number = "Must be ≥ 1"
      } else if (seenLineNumbers.has(li.line_number)) {
        lineErr.line_number = "Duplicate"
      } else {
        seenLineNumbers.add(li.line_number)
      }
      if (!li.item_description.trim()) lineErr.item_description = "Required"
      const q = Number(li.quantity)
      if (!li.quantity.trim() || !Number.isFinite(q) || q <= 0) {
        lineErr.quantity = "> 0"
      }
      const p = Number(li.unit_price)
      if (!li.unit_price.trim() || !Number.isFinite(p) || p < 0) {
        lineErr.unit_price = "≥ 0"
      }
      return lineErr
    })
    if (perLine.some((e) => Object.keys(e).length > 0)) next.perLine = perLine
    setErrors(next)
    return (
      !next.po_number &&
      !next.vendor_id &&
      !next.issue_date &&
      !next.line_items &&
      !next.perLine
    )
  }

  const onSubmit = async () => {
    if (!validate()) return
    const lineItems = form.line_items.map((li) => {
      const q = Number(li.quantity)
      const p = Number(li.unit_price)
      return {
        line_number: li.line_number,
        item_code: li.item_code.trim() || null,
        item_description: li.item_description.trim(),
        quantity: q,
        unit_price: p,
        total_price: Number((q * p).toFixed(2)),
        unit_of_measure: li.unit_of_measure.trim() || null,
      }
    })
    const total = Number(
      lineItems.reduce((a, li) => a + li.total_price, 0).toFixed(2)
    )
    try {
      if (isEdit && poId) {
        const result = await updateMutation.mutateAsync({
          id: poId,
          payload: {
            po_number: form.po_number.trim(),
            vendor_id: form.vendor_id,
            issue_date: form.issue_date,
            expected_delivery_date: form.expected_delivery_date || null,
            status: form.status,
            currency: form.currency,
            notes: form.notes.trim() || null,
            line_items: lineItems,
          },
        })
        toast.success(`Updated ${result.po_number}`)
        onSaved?.(result.id)
      } else {
        const result = await createMutation.mutateAsync({
          po_number: form.po_number.trim(),
          vendor_id: form.vendor_id,
          issue_date: form.issue_date,
          expected_delivery_date: form.expected_delivery_date || null,
          status: form.status,
          total_amount: total,
          currency: form.currency,
          notes: form.notes.trim() || null,
          line_items: lineItems,
        })
        toast.success(`Created ${result.po_number}`)
        onSaved?.(result.id)
      }
      onOpenChange(false)
    } catch (e: unknown) {
      const detail =
        isAxiosError(e) && typeof e.response?.data?.detail === "string"
          ? e.response.data.detail
          : e instanceof Error
            ? e.message
            : "Save failed"
      toast.error(isEdit ? "Could not update PO" : "Could not create PO", {
        description: detail,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit purchase order" : "New purchase order"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the PO. Existing reconciliations remain attached and historical line-item references are preserved when possible."
              : "Create a new PO that the matcher agent will reference when reconciling invoices."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="po-number" label="PO number" required error={errors.po_number}>
              <Input
                id="po-number"
                value={form.po_number}
                onChange={(e) => updateField("po_number", e.target.value)}
                placeholder="PO-2026-101"
                maxLength={50}
                autoFocus={!isEdit}
              />
            </Field>
            <Field id="po-vendor" label="Vendor" required error={errors.vendor_id}>
              <Combobox
                triggerId="po-vendor"
                options={vendorOptions}
                value={form.vendor_id || null}
                onChange={(v) => updateField("vendor_id", v)}
                placeholder="Pick a vendor…"
                searchPlaceholder="Search by name, code, tax ID…"
                emptyMessage="No matching vendor."
                invalid={!!errors.vendor_id}
              />
            </Field>
            <Field id="po-issue" label="Issue date" required error={errors.issue_date}>
              <Input
                id="po-issue"
                type="date"
                value={form.issue_date}
                onChange={(e) => updateField("issue_date", e.target.value)}
              />
            </Field>
            <Field id="po-delivery" label="Expected delivery">
              <Input
                id="po-delivery"
                type="date"
                value={form.expected_delivery_date}
                onChange={(e) =>
                  updateField("expected_delivery_date", e.target.value)
                }
              />
            </Field>
            <Field id="po-status" label="Status">
              <select
                id="po-status"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field id="po-currency" label="Currency">
              <Input
                id="po-currency"
                value={form.currency}
                onChange={(e) =>
                  updateField("currency", e.target.value.toUpperCase())
                }
                maxLength={3}
                placeholder="USD"
              />
            </Field>
          </div>

          <Field id="po-notes" label="Notes">
            <Textarea
              id="po-notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              placeholder="Internal notes for this PO"
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Line items</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addLine}
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </div>
            {errors.line_items && (
              <p className="text-xs text-destructive">{errors.line_items}</p>
            )}
            <div className="space-y-2">
              {form.line_items.map((li, idx) => {
                const lineErrors = errors.perLine?.[idx] ?? {}
                const lineTotal = livePerLineTotals[idx]
                return (
                  <div
                    key={li.key}
                    className="rounded-lg border border-border/60 p-3 space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-2 sm:col-span-1">
                        <Label
                          htmlFor={`line-${idx}-num`}
                          className="text-[11px] text-muted-foreground"
                        >
                          #
                        </Label>
                        <Input
                          id={`line-${idx}-num`}
                          type="number"
                          min={1}
                          value={li.line_number}
                          onChange={(e) =>
                            updateLine(
                              idx,
                              "line_number",
                              Number(e.target.value)
                            )
                          }
                          className="h-9"
                          aria-invalid={!!lineErrors.line_number || undefined}
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-3">
                        <Label
                          htmlFor={`line-${idx}-code`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Item code
                        </Label>
                        <Input
                          id={`line-${idx}-code`}
                          value={li.item_code}
                          onChange={(e) =>
                            updateLine(idx, "item_code", e.target.value)
                          }
                          className="h-9 font-mono text-xs"
                          maxLength={100}
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-8">
                        <Label
                          htmlFor={`line-${idx}-desc`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Description
                        </Label>
                        <Input
                          id={`line-${idx}-desc`}
                          value={li.item_description}
                          onChange={(e) =>
                            updateLine(idx, "item_description", e.target.value)
                          }
                          className="h-9"
                          maxLength={500}
                          aria-invalid={
                            !!lineErrors.item_description || undefined
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <Label
                          htmlFor={`line-${idx}-qty`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Quantity
                        </Label>
                        <Input
                          id={`line-${idx}-qty`}
                          type="number"
                          step="0.001"
                          min={0}
                          value={li.quantity}
                          onChange={(e) =>
                            updateLine(idx, "quantity", e.target.value)
                          }
                          className="h-9 tabular-nums"
                          aria-invalid={!!lineErrors.quantity || undefined}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label
                          htmlFor={`line-${idx}-uom`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Unit
                        </Label>
                        <Input
                          id={`line-${idx}-uom`}
                          value={li.unit_of_measure}
                          onChange={(e) =>
                            updateLine(idx, "unit_of_measure", e.target.value)
                          }
                          className="h-9"
                          maxLength={20}
                          placeholder="pcs"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label
                          htmlFor={`line-${idx}-price`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Unit price
                        </Label>
                        <Input
                          id={`line-${idx}-price`}
                          type="number"
                          step="0.01"
                          min={0}
                          value={li.unit_price}
                          onChange={(e) =>
                            updateLine(idx, "unit_price", e.target.value)
                          }
                          className="h-9 tabular-nums"
                          aria-invalid={!!lineErrors.unit_price || undefined}
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="text-[11px] text-muted-foreground">
                          Line total
                        </div>
                        <div className="font-mono tabular-nums text-sm font-medium">
                          {formatCurrency(lineTotal, form.currency)}
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(idx)}
                          disabled={form.line_items.length === 1}
                          aria-label={`Remove line ${li.line_number}`}
                          className="text-muted-foreground hover:text-destructive size-9"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {(lineErrors.line_number ||
                      lineErrors.item_description ||
                      lineErrors.quantity ||
                      lineErrors.unit_price) && (
                      <p className="text-xs text-destructive">
                        {[
                          lineErrors.line_number && `Line #: ${lineErrors.line_number}`,
                          lineErrors.item_description &&
                            `Description: ${lineErrors.item_description}`,
                          lineErrors.quantity && `Quantity: ${lineErrors.quantity}`,
                          lineErrors.unit_price && `Unit price: ${lineErrors.unit_price}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <div className="text-sm text-muted-foreground">
              {form.line_items.length}{" "}
              {form.line_items.length === 1 ? "line" : "lines"}
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                PO total
              </div>
              <div className="font-mono tabular-nums font-bold text-lg">
                {formatCurrency(liveTotal, form.currency)}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id?: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
