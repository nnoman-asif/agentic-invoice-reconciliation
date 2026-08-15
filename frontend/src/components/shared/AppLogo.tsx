import { ReceiptText, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AppLogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function AppLogo({ className, size = "md" }: AppLogoProps) {
  const containerSize =
    size === "sm"
      ? "size-7 rounded-lg"
      : size === "md"
        ? "size-9 rounded-xl"
        : "size-11 rounded-[14px]"
  const iconSize =
    size === "sm" ? "size-3.5" : size === "md" ? "size-[18px]" : "size-5"
  const sparkleSize =
    size === "sm" ? "size-2" : size === "md" ? "size-2.5" : "size-3"

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0 overflow-hidden",
        "bg-gradient-to-b from-blue-500 via-indigo-500 to-violet-600",
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),_0_4px_12px_-2px_rgba(99,102,241,0.4)]",
        containerSize,
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-60 mix-blend-overlay" />

      <div className="relative z-10 flex items-center justify-center">
        <ReceiptText
          className={cn("text-white drop-shadow-md", iconSize)}
          strokeWidth={1.5}
        />
        <Sparkles
          className={cn(
            "text-white absolute -top-1 -right-1 drop-shadow-sm",
            sparkleSize
          )}
          strokeWidth={2.5}
          fill="currentColor"
        />
      </div>
    </div>
  )
}
