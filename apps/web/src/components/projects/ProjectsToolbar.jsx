"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/Input";

export function ProjectsToolbar({
  search,
  visibility,
  sort,
  onSearchChange,
  onVisibilityChange,
  onSortChange,
}) {
  return (
    <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark flex flex-col gap-4 rounded-3xl border p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full max-w-md">
        <Search
          className="text-muted-foreground dark:text-muted-foreground-dark absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          strokeWidth={1.5}
        />

        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search projects..."
          className="pl-10"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={visibility}
          onChange={(event) => onVisibilityChange(event.target.value)}
          className="border-border bg-background text-foreground focus:border-brand-500 dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark h-11 rounded-xl border px-4 text-sm shadow-sm transition-colors outline-none"
        >
          <option value="all">All Visibility</option>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>

        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          className="border-border bg-background text-foreground focus:border-brand-500 dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark h-11 rounded-xl border px-4 text-sm shadow-sm transition-colors outline-none"
        >
          <option value="recent">Recently Updated</option>
          <option value="name">Project Name</option>
          <option value="progress">Progress</option>
        </select>
      </div>
    </div>
  );
}
