import * as React from "react";

import { cn } from "@/lib/cn";

export const Input = React.forwardRef(
  ({ className, type = "text", isInvalid = false, disabled = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        aria-invalid={isInvalid}
        className={cn(
          "bg-background text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm",
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

Input.displayName = "Input";
