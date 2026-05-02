import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps extends React.HTMLAttributes<HTMLButtonElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onCheckedChange?.(!checked)
        }}
        className={cn(
          "size-4 shrink-0 rounded border border-border ring-offset-background transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-background hover:border-primary/60",
          className
        )}
        {...props}
      >
        {checked && <Check className="size-3 mx-auto" strokeWidth={3} />}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"
