"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Command, Menu, Plus, Search } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { SearchModal } from "@/components/search/SearchModal";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { fetchNotifications } from "@/lib/notifications-api";

const PAGE_LABELS = {
    "/dashboard": "Dashboard",
    "/issues":    "Issues",
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

export function TopBar({ onMenuClick }) {
    const pathname = usePathname();
    const { currentWorkspace, accessToken } = useApp();
    const label = getLabel(pathname);

    const [searchOpen, setSearchOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [unread, setUnread] = useState(0);

    // Keyboard shortcut: Cmd/Ctrl+K → open search
    useEffect(() => {
        function handler(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === "Escape") {
                setSearchOpen(false);
                setNotifOpen(false);
            }
        }
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // Poll unread count every 30s
    useEffect(() => {
        if (!accessToken) return;
        const load = () =>
            fetchNotifications(accessToken)
                .then((d) => setUnread(d.unreadCount))
                .catch(() => {});
        load();
        const id = setInterval(load, 30000);
        return () => clearInterval(id);
    }, [accessToken]);

    return (
        <>
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-(--border) bg-(--bg-elevated)/80 backdrop-blur-md px-3 sm:px-5">
                {/* Mobile menu toggle */}
                <button
                    aria-label="Toggle sidebar"
                    onClick={onMenuClick}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) hover:text-(--text-secondary) transition-colors md:hidden"
                >
                    <Menu className="h-4 w-4" />
                </button>

                {/* Page title */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-sm font-semibold text-(--text-primary)">{label}</h1>
                        {currentWorkspace && (
                            <>
                                <span className="text-(--text-muted) text-sm hidden sm:inline">/</span>
                                <span className="hidden sm:inline text-sm text-(--text-muted) truncate max-w-32">{currentWorkspace.name}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                    {/* Search bar — desktop */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="hidden sm:flex h-8 items-center gap-2 rounded-lg border border-(--border) bg-(--bg-sunken) px-3 text-xs text-(--text-muted) hover:border-(--border-strong) hover:text-(--text-secondary) transition-colors"
                    >
                        <Search className="h-3.5 w-3.5" />
                        <span>Search...</span>
                        <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-(--border) bg-(--bg-overlay) px-1 py-0.5 text-[10px] sm:flex">
                            <Command className="h-2.5 w-2.5" />K
                        </kbd>
                    </button>

                    {/* Search icon — mobile */}
                    <button
                        aria-label="Search"
                        onClick={() => setSearchOpen(true)}
                        className="flex sm:hidden h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) hover:text-(--text-secondary) transition-colors"
                    >
                        <Search className="h-4 w-4" />
                    </button>

                    {/* New issue shortcut */}
                    <a
                        href="/issues"
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">New</span>
                    </a>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            aria-label="View notifications"
                            onClick={() => setNotifOpen((o) => !o)}
                            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) hover:text-(--text-secondary) transition-colors"
                        >
                            <Bell className="h-4 w-4" />
                            {unread > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-0.5 text-[9px] font-bold text-white">
                                    {unread > 9 ? "9+" : unread}
                                </span>
                            )}
                        </button>
                        <NotificationsPanel
                            open={notifOpen}
                            onClose={() => setNotifOpen(false)}
                        />
                    </div>
                </div>
            </header>

            <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
