"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Command, Plus, Search } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

const PAGE_LABELS = {
    "/dashboard": "Dashboard",
    "/issues":    "My Issues",
    "/projects":  "Projects",
    "/team":      "Team",
    "/analytics": "Analytics",
    "/settings":  "Settings",
};

function getLabel(pathname) {
    for (const [key, label] of Object.entries(PAGE_LABELS)) {
        if (pathname === key || pathname.startsWith(`${key}/`)) return label;
    }
    if (pathname.startsWith("/projects/")) return "Project Board";
    return "FlexFlow";
}

export function TopBar() {
    const pathname = usePathname();
    const { currentWorkspace } = useApp();
    const label = getLabel(pathname);

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-(--border) bg-(--bg-elevated)/80 backdrop-blur-md px-4 sm:px-6">
            {/* Page title */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h1 className="text-sm font-semibold text-(--text-primary)">{label}</h1>
                    {currentWorkspace && (
                        <>
                            <span className="text-(--text-muted) text-sm">/</span>
                            <span className="text-sm text-(--text-muted) truncate max-w-40">{currentWorkspace.name}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
                <button className="hidden sm:flex h-8 items-center gap-2 rounded-lg border border-(--border) bg-(--bg-sunken) px-3 text-xs text-(--text-muted) hover:border-(--border-strong) hover:text-(--text-secondary) transition-colors">
                    <Search className="h-3.5 w-3.5" />
                    <span>Search...</span>
                    <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-(--border) bg-(--bg-overlay) px-1.5 py-0.5 text-[10px] sm:flex">
                        <Command className="h-2.5 w-2.5" />K
                    </kbd>
                </button>

                <Link
                    href="/projects"
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New</span>
                </Link>

                <button className="flex h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) hover:text-(--text-secondary) transition-colors">
                    <Bell className="h-4 w-4" />
                </button>
            </div>
        </header>
    );
}
