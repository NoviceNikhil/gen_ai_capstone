import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  size = "default",
  ...props
}) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "w-full min-w-0 rounded-lg border border-border-light bg-surface-1/60 text-foreground transition-all duration-200 outline-none placeholder:text-text-faint/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        // Focus state
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
        // Sizes
        size === "default" && "h-10 px-4 py-2.5 text-sm",
        size === "sm" && "h-8 px-2.5 py-1 text-xs",
        size === "lg" && "h-12 px-5 py-3 text-base",
        className
      )}
      {...props} />
  );
}

export { Input }
