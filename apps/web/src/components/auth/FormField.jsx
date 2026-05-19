import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/cn";

export function FormField({ id, label, error, className, children }) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-foreground dark:text-foreground-dark text-sm font-medium">
        {label}
      </label>

      {children}

      {error ? (
        <p className="text-danger-600 dark:text-danger-400 flex items-center gap-2 text-xs">
          <AlertCircle className="h-3.5 w-3.5" />
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
