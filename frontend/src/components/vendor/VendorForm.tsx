import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
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
import { useCreateVendor, useUpdateVendor, type Vendor } from "@/api/vendors"

interface VendorFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, dialog is in Edit mode and pre-fills from this vendor. */
  vendor?: Vendor | null
  /** Called after a successful create/update with the resulting id. */
  onSaved?: (vendorId: string) => void
}

interface FormState {
  code: string
  name: string
  tax_id: string
  address: string
  contact_email: string
}

const EMPTY: FormState = {
  code: "",
  name: "",
  tax_id: "",
  address: "",
  contact_email: "",
}

export function VendorForm({
  open,
  onOpenChange,
  vendor,
  onSaved,
}: VendorFormProps) {
  const isEdit = !!vendor
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const createMutation = useCreateVendor()
  const updateMutation = useUpdateVendor()
  const pending = createMutation.isPending || updateMutation.isPending

  // Sync form state when the vendor prop changes (Edit mode) or the
  // dialog opens fresh (Add mode).
  useEffect(() => {
    if (!open) return
    if (vendor) {
      setForm({
        code: vendor.code,
        name: vendor.name,
        tax_id: vendor.tax_id ?? "",
        address: vendor.address ?? "",
        contact_email: vendor.contact_email ?? "",
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, vendor])

  const update = <K extends keyof FormState>(key: K, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.code.trim()) next.code = "Required"
    if (!form.name.trim()) next.name = "Required"
    if (
      form.contact_email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())
    ) {
      next.contact_email = "Invalid email"
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async () => {
    if (!validate()) return
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      tax_id: form.tax_id.trim() || null,
      address: form.address.trim() || null,
      contact_email: form.contact_email.trim() || null,
    }
    try {
      if (isEdit && vendor) {
        const result = await updateMutation.mutateAsync({
          id: vendor.id,
          payload,
        })
        toast.success(`Updated ${result.name}`)
        onSaved?.(result.id)
      } else {
        const result = await createMutation.mutateAsync(payload)
        toast.success(`Created vendor ${result.name}`)
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
      toast.error(isEdit ? "Could not update vendor" : "Could not create vendor", {
        description: detail,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "New vendor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update vendor details. Existing POs and invoices will continue to reference this vendor."
              : "Add a new vendor that purchase orders and invoices can reference."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field
            id="vendor-code"
            label="Code"
            error={errors.code}
            required
            hint="Short identifier used in CSV imports and the matcher agent (e.g. ACME-001)."
          >
            <Input
              id="vendor-code"
              value={form.code}
              onChange={(e) => update("code", e.target.value)}
              maxLength={50}
              placeholder="ACME-001"
              autoFocus={!isEdit}
            />
          </Field>
          <Field
            id="vendor-name"
            label="Name"
            error={errors.name}
            required
          >
            <Input
              id="vendor-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              maxLength={255}
              placeholder="Acme Industrial Supplies"
            />
          </Field>
          <Field
            id="vendor-tax-id"
            label="Tax ID"
            hint="The matcher agent matches incoming invoices on this first."
          >
            <Input
              id="vendor-tax-id"
              value={form.tax_id}
              onChange={(e) => update("tax_id", e.target.value)}
              maxLength={50}
              placeholder="TAX-ACME-9821"
            />
          </Field>
          <Field id="vendor-email" label="Contact email" error={errors.contact_email}>
            <Input
              id="vendor-email"
              type="email"
              value={form.contact_email}
              onChange={(e) => update("contact_email", e.target.value)}
              placeholder="billing@acme.com"
            />
          </Field>
          <Field id="vendor-address" label="Address">
            <Textarea
              id="vendor-address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Street, city, country"
              rows={2}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create vendor"}
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
  hint,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
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
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
