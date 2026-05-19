import * as React from "react";

import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  secondary: "bg-muted text-muted-foreground dark:bg-muted-dark dark:text-muted-foreground-dark",
  success: "bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300",
  warning: "bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300",
  destructive: "bg-danger-100 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300",
};

export function Badge({ className, variant = "primary", children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
        "transition-colors duration-150 ease-out",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
