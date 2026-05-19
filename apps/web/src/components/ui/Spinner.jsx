import { cn } from "@/lib/cn";

export function Spinner({ className, size = "md", label = "Loading" }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]",
  };

  return (
    <div role="status" aria-label={label} className="inline-flex items-center justify-center">
      <span
        className={cn(
          "text-brand-600 dark:text-brand-400 animate-spin rounded-full border-current border-t-transparent",
          sizes[size],
          className
        )}
      />

      <span className="sr-only">{label}</span>
    </div>
  );
}
