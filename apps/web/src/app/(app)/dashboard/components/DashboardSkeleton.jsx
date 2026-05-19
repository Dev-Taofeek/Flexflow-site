import { Skeleton } from "@/components/ui/Skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
          <Skeleton className="h-5 w-32" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>

        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6 lg:col-span-2">
          <Skeleton className="h-5 w-40" />

          <div className="mt-6 space-y-5">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
          <Skeleton className="h-5 w-40" />

          <div className="mt-6 space-y-5">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
          <Skeleton className="h-5 w-44" />

          <div className="mt-6 space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
