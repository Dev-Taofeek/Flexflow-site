import * as React from "react";

import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef(
  ({ className, isInvalid = false, disabled = false, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        rows={rows}
        aria-invalid={isInvalid}
        className={cn(
          "bg-background text-foreground flex min-h-24 w-full resize-y rounded-md border px-3 py-2 text-sm shadow-sm",
          "placeholder:text-muted-foreground",
          "transition-colors duration-150 ease-out",
          "focus-visible:ring-brand-500 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-background-dark dark:text-foreground-dark dark:placeholder:text-muted-foreground-dark",
          isInvalid
            ? "border-danger-500 focus-visible:ring-danger-500"
            : "border-border hover:border-border-strong dark:border-border-dark dark:hover:border-border-strong-dark",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
