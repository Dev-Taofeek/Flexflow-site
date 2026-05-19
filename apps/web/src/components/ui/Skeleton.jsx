import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted dark:bg-muted-dark animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
