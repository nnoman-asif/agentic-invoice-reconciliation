import { useEffect, useMemo, useRef, useState } from "react"
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
  useCreateReceipt,
  useDeliveryReceipt,
  useUpdateReceipt,
} from "@/api/delivery-receipts"
import { usePurchaseOrder, usePurchaseOrders } from "@/api/purchase-orders"

interface ReceiptFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receiptId?: string | null
  onSaved?: (receiptId: string) => void
}

interface LineItemDraft {
  key: string
  po_line_item_id: string
  item_description: string
  quantity_received: string
  quantity_accepted: string
  quantity_rejected: string
}

interface FormState {
  receipt_number: string
  po_id: string
  received_date: string
  receiver_name: string
  status: string
  notes: string
  line_items: LineItemDraft[]
}

interface FormErrors {
  receipt_number?: string
  po_id?: string
  received_date?: string
  line_items?: string
  perLine?: Array<
    Partial<
      Record<
        | "item_description"
        | "quantity_received"
        | "quantity_accepted"
        | "quantity_rejected",
        string
      >
    >
  >
}

const today = () => new Date().toISOString().slice(0, 10)

const blankLine = (): LineItemDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  po_line_item_id: "",
  item_description: "",
  quantity_received: "",
  quantity_accepted: "",
  quantity_rejected: "0",
})

const emptyForm = (): FormState => ({
  receipt_number: "",
  po_id: "",
  received_date: today(),
  receiver_name: "",
  status: "received",
  notes: "",
  line_items: [blankLine()],
})

export function ReceiptForm({
  open,
  onOpenChange,
  receiptId,
  onSaved,
}: ReceiptFormProps) {
  const isEdit = !!receiptId
  const { data: existing } = useDeliveryReceipt(isEdit ? receiptId : null)
  const { data: pos } = usePurchaseOrders()
  const createMutation = useCreateReceipt()
  const updateMutation = useUpdateReceipt()
  const pending = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const lastSeededPo = useRef<string | null>(null)

  const { data: selectedPO } = usePurchaseOrder(form.po_id || null)

  useEffect(() => {
    if (!open) return
    if (isEdit && existing) {
      setForm({
        receipt_number: existing.receipt_number,
        po_id: existing.po_id,
        received_date: existing.received_date,
        receiver_name: existing.receiver_name ?? "",
        status: existing.status,
        notes: existing.notes ?? "",
        line_items: existing.line_items.map((li) => ({
          key: li.id,
          po_line_item_id: li.po_line_item_id ?? "",
          item_description: li.item_description,
          quantity_received: String(li.quantity_received),
          quantity_accepted: String(li.quantity_accepted),
          quantity_rejected: String(li.quantity_rejected),
        })),
      })
      setErrors({})
      lastSeededPo.current = existing.po_id
    } else if (!isEdit) {
      setForm(emptyForm())
      setErrors({})
      lastSeededPo.current = null
    }
  }, [open, isEdit, existing])

  useEffect(() => {
    if (!open) return
    if (!selectedPO || selectedPO.id !== form.po_id) return
    if (lastSeededPo.current === selectedPO.id) return
    lastSeededPo.current = selectedPO.id
    const seeded =
      selectedPO.line_items.length > 0
        ? selectedPO.line_items
            .slice()
            .sort((a, b) => a.line_number - b.line_number)
            .map((li) => ({
              key: li.id,
              po_line_item_id: li.id,
              item_description: li.item_description,
              quantity_received: String(li.quantity),
              quantity_accepted: String(li.quantity),
              quantity_rejected: "0",
            }))
        : [blankLine()]
    setForm((f) => ({ ...f, line_items: seeded }))
  }, [open, selectedPO, form.po_id])

  const poOptions: ComboboxOption[] = useMemo(
    () =>
      (pos ?? []).map((po) => ({
        value: po.id,
        label: po.po_number,
        hint: po.status,
        keywords: [po.id],
      })),
    [pos]
  )

  const poLineOptions = selectedPO?.line_items ?? []

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
      line_items: f.line_items.map((li, i) => {
        if (i !== idx) return li
        const next = { ...li, [key]: value }
        if (key === "po_line_item_id" && value) {
          const poLine = poLineOptions.find((pl) => pl.id === value)
          if (poLine && !li.item_description.trim()) {
            next.item_description = poLine.item_description
          }
        }
        return next
      }),
    }))
  }

  const addLine = () => {
    setForm((f) => ({ ...f, line_items: [...f.line_items, blankLine()] }))
  }

  const removeLine = (idx: number) => {
    setForm((f) => ({
      ...f,
      line_items: f.line_items.filter((_, i) => i !== idx),
    }))
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!form.receipt_number.trim()) next.receipt_number = "Required"
    if (!form.po_id) next.po_id = "Required"
    if (!form.received_date) next.received_date = "Required"
    if (form.line_items.length === 0) next.line_items = "Add at least one line"
    const perLine = form.line_items.map((li) => {
      const lineErr: NonNullable<FormErrors["perLine"]>[number] = {}
      if (!li.item_description.trim()) lineErr.item_description = "Required"
      const rec = Number(li.quantity_received)
      const acc = Number(li.quantity_accepted)
      const rej = Number(li.quantity_rejected || "0")
      if (!li.quantity_received.trim() || !Number.isFinite(rec) || rec < 0) {
        lineErr.quantity_received = "≥ 0"
      }
      if (!li.quantity_accepted.trim() || !Number.isFinite(acc) || acc < 0) {
        lineErr.quantity_accepted = "≥ 0"
      }
      if (!Number.isFinite(rej) || rej < 0) {
        lineErr.quantity_rejected = "≥ 0"
      }
      if (
        Number.isFinite(rec) &&
        Number.isFinite(acc) &&
        Number.isFinite(rej) &&
        Math.round((rec - acc - rej) * 1000) / 1000 !== 0
      ) {
        lineErr.quantity_rejected = "received ≠ accepted + rejected"
      }
      return lineErr
    })
    if (perLine.some((e) => Object.keys(e).length > 0)) next.perLine = perLine
    setErrors(next)
    return (
      !next.receipt_number &&
      !next.po_id &&
      !next.received_date &&
      !next.line_items &&
      !next.perLine
    )
  }

  const onSubmit = async () => {
    if (!validate()) return
    const lineItems = form.line_items.map((li) => ({
      po_line_item_id: li.po_line_item_id || null,
      item_description: li.item_description.trim(),
      quantity_received: Number(li.quantity_received),
      quantity_accepted: Number(li.quantity_accepted),
      quantity_rejected: Number(li.quantity_rejected || "0"),
    }))
    try {
      if (isEdit && receiptId) {
        const result = await updateMutation.mutateAsync({
          id: receiptId,
          payload: {
            receipt_number: form.receipt_number.trim(),
            po_id: form.po_id,
            received_date: form.received_date,
            receiver_name: form.receiver_name.trim() || null,
            status: form.status,
            notes: form.notes.trim() || null,
            line_items: lineItems,
          },
        })
        toast.success(`Updated ${result.receipt_number}`)
        onSaved?.(result.id)
      } else {
        const result = await createMutation.mutateAsync({
          receipt_number: form.receipt_number.trim(),
          po_id: form.po_id,
          received_date: form.received_date,
          receiver_name: form.receiver_name.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
          line_items: lineItems,
        })
        toast.success(`Created ${result.receipt_number}`)
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
      toast.error(
        isEdit ? "Could not update receipt" : "Could not create receipt",
        { description: detail }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit delivery receipt" : "New delivery receipt"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the receipt. Line-item matches stay attached when existing lines can be reused."
              : "Record goods received against a purchase order so the matcher can three-way reconcile."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              id="dr-number"
              label="Receipt number"
              required
              error={errors.receipt_number}
            >
              <Input
                id="dr-number"
                value={form.receipt_number}
                onChange={(e) => updateField("receipt_number", e.target.value)}
                placeholder="REC-2026-101"
                maxLength={50}
                autoFocus={!isEdit}
              />
            </Field>
            <Field id="dr-po" label="Purchase order" required error={errors.po_id}>
              <Combobox
                triggerId="dr-po"
                options={poOptions}
                value={form.po_id || null}
                onChange={(v) => {
                  lastSeededPo.current = null
                  updateField("po_id", v)
                }}
                placeholder="Pick a PO…"
                searchPlaceholder="Search PO number…"
                emptyMessage="No matching purchase order."
                invalid={!!errors.po_id}
              />
            </Field>
            <Field
              id="dr-date"
              label="Received date"
              required
              error={errors.received_date}
            >
              <Input
                id="dr-date"
                type="date"
                value={form.received_date}
                onChange={(e) => updateField("received_date", e.target.value)}
              />
            </Field>
            <Field id="dr-receiver" label="Receiver">
              <Input
                id="dr-receiver"
                value={form.receiver_name}
                onChange={(e) => updateField("receiver_name", e.target.value)}
                placeholder="Name on the dock"
                maxLength={255}
              />
            </Field>
            <Field id="dr-status" label="Status">
              <select
                id="dr-status"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="received">Received</option>
                <option value="partial">Partial</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
          </div>

          <Field id="dr-notes" label="Notes">
            <Textarea
              id="dr-notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              placeholder="Shortages, damage, dock notes"
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
                return (
                  <div
                    key={li.key}
                    className="rounded-lg border border-border/60 p-3 space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 sm:col-span-5">
                        <Label
                          htmlFor={`dr-line-${idx}-po`}
                          className="text-[11px] text-muted-foreground"
                        >
                          PO line
                        </Label>
                        <select
                          id={`dr-line-${idx}-po`}
                          value={li.po_line_item_id}
                          onChange={(e) =>
                            updateLine(idx, "po_line_item_id", e.target.value)
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value="">None</option>
                          {poLineOptions.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.line_number} · {pl.item_description}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-12 sm:col-span-7">
                        <Label
                          htmlFor={`dr-line-${idx}-desc`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Description
                        </Label>
                        <Input
                          id={`dr-line-${idx}-desc`}
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
                          htmlFor={`dr-line-${idx}-rec`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Received
                        </Label>
                        <Input
                          id={`dr-line-${idx}-rec`}
                          type="number"
                          step="0.001"
                          min={0}
                          value={li.quantity_received}
                          onChange={(e) =>
                            updateLine(idx, "quantity_received", e.target.value)
                          }
                          className="h-9 tabular-nums"
                          aria-invalid={
                            !!lineErrors.quantity_received || undefined
                          }
                        />
                      </div>
                      <div className="col-span-3">
                        <Label
                          htmlFor={`dr-line-${idx}-acc`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Accepted
                        </Label>
                        <Input
                          id={`dr-line-${idx}-acc`}
                          type="number"
                          step="0.001"
                          min={0}
                          value={li.quantity_accepted}
                          onChange={(e) =>
                            updateLine(idx, "quantity_accepted", e.target.value)
                          }
                          className="h-9 tabular-nums"
                          aria-invalid={
                            !!lineErrors.quantity_accepted || undefined
                          }
                        />
                      </div>
                      <div className="col-span-3">
                        <Label
                          htmlFor={`dr-line-${idx}-rej`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Rejected
                        </Label>
                        <Input
                          id={`dr-line-${idx}-rej`}
                          type="number"
                          step="0.001"
                          min={0}
                          value={li.quantity_rejected}
                          onChange={(e) =>
                            updateLine(idx, "quantity_rejected", e.target.value)
                          }
                          className="h-9 tabular-nums"
                          aria-invalid={
                            !!lineErrors.quantity_rejected || undefined
                          }
                        />
                      </div>
                      <div className="col-span-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(idx)}
                          disabled={form.line_items.length === 1}
                          aria-label="Remove line"
                          className="text-muted-foreground hover:text-destructive size-9"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {(lineErrors.item_description ||
                      lineErrors.quantity_received ||
                      lineErrors.quantity_accepted ||
                      lineErrors.quantity_rejected) && (
                      <p className="text-xs text-destructive">
                        {[
                          lineErrors.item_description &&
                            `Description: ${lineErrors.item_description}`,
                          lineErrors.quantity_received &&
                            `Received: ${lineErrors.quantity_received}`,
                          lineErrors.quantity_accepted &&
                            `Accepted: ${lineErrors.quantity_accepted}`,
                          lineErrors.quantity_rejected &&
                            `Rejected: ${lineErrors.quantity_rejected}`,
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create receipt"}
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
  children,
}: {
  id?: string
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
