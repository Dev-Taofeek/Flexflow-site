"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, Check, ChevronDown, Command, LayoutGrid, Loader2, Menu, Plus, Search, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/contexts/AppContext";
import { SearchModal } from "@/components/search/SearchModal";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { fetchNotifications } from "@/lib/notifications-api";
import { apiRequest } from "@/lib/api-client";

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

// ── Mobile Org/Workspace Bottom Sheet ──────────────────────────────────────
function MobileOrgSheet({ open, onClose }) {
    const router = useRouter();
    const { organizations, currentOrg, currentWorkspace, switchOrg, switchWorkspace, accessToken, refreshOrganizations } = useApp();

    const [tab, setTab] = useState("orgs"); // "orgs" | "workspaces" | "new-org" | "new-ws"
    const [orgForm, setOrgForm] = useState({ name: "", workspaceName: "General" });
    const [wsForm, setWsForm] = useState({ name: "" });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (open) { setTab("orgs"); setErr(""); }
    }, [open]);

    async function createOrg(e) {
        e.preventDefault();
        if (!orgForm.name.trim()) { setErr("Name required"); return; }
        setLoading(true); setErr("");
        try {
            await apiRequest("/organizations", {
                method: "POST", token: accessToken,
                body: { name: orgForm.name, workspaceName: orgForm.workspaceName || "General" },
            });
            await refreshOrganizations();
            setOrgForm({ name: "", workspaceName: "General" });
            setTab("orgs");
        } catch (ex) { setErr(ex.message); }
        finally { setLoading(false); }
    }

    async function createWorkspace(e) {
        e.preventDefault();
        if (!wsForm.name.trim()) { setErr("Name required"); return; }
        setLoading(true); setErr("");
        try {
            await apiRequest("/workspaces", {
                method: "POST", token: accessToken,
                body: { name: wsForm.name, organizationId: currentOrg?.id },
            });
            await refreshOrganizations();
            setWsForm({ name: "" });
            setTab("workspaces");
        } catch (ex) { setErr(ex.message); }
        finally { setLoading(false); }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" onClick={onClose}>
            <div className="fixed inset-0 bg-black/40" />
            <div
                className="relative w-full rounded-t-2xl border-t border-(--border) bg-(--bg-elevated) shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1 w-10 rounded-full bg-(--border)" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-(--border)">
                    <h2 className="text-sm font-semibold text-(--text-primary)">
                        {tab === "new-org" ? "New Organization" : tab === "new-ws" ? "New Workspace" : tab === "workspaces" ? "Workspaces" : "Organizations"}
                    </h2>
                    <button aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-overlay)">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4 pb-8">
                    {/* Org list */}
                    {tab === "orgs" && (
                        <div className="space-y-1">
                            {organizations.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => { switchOrg(org.id); onClose(); router.push("/dashboard"); }}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-(--bg-overlay)"
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">
                                        {org.name[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-(--text-primary)">{org.name}</p>
                                        <p className="text-xs text-(--text-muted)">{org.workspaces?.length || 0} workspace{org.workspaces?.length !== 1 ? "s" : ""}</p>
                                    </div>
                                    {currentOrg?.id === org.id && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                                </button>
                            ))}

                            {currentOrg && (
                                <button
                                    onClick={() => setTab("workspaces")}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-(--bg-overlay) mt-2 border-t border-(--border) pt-3"
                                >
                                    <LayoutGrid className="h-4 w-4 text-(--text-muted)" />
                                    <span className="text-sm text-(--text-secondary)">Switch workspace in {currentOrg.name}</span>
                                    <ChevronDown className="h-3.5 w-3.5 ml-auto text-(--text-muted) -rotate-90" />
                                </button>
                            )}

                            <button
                                onClick={() => setTab("new-org")}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-indigo-600 transition-colors hover:bg-indigo-50 mt-1"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-sm font-medium">New organization</span>
                            </button>
                        </div>
                    )}

                    {/* Workspace list */}
                    {tab === "workspaces" && (
                        <div className="space-y-1">
                            <button onClick={() => setTab("orgs")} className="flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text-primary) mb-3">
                                <ChevronDown className="h-3 w-3 rotate-90" /> Back to orgs
                            </button>
                            {(currentOrg?.workspaces || []).map((ws) => (
                                <button
                                    key={ws.id}
                                    onClick={() => { switchWorkspace(ws.id); onClose(); }}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-(--bg-overlay)"
                                >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-(--bg-overlay)">
                                        <LayoutGrid className="h-3.5 w-3.5 text-(--text-muted)" />
                                    </div>
                                    <span className="flex-1 truncate text-sm text-(--text-primary)">{ws.name}</span>
                                    {currentWorkspace?.id === ws.id && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                                </button>
                            ))}
                            <button
                                onClick={() => setTab("new-ws")}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-indigo-600 hover:bg-indigo-50 mt-1"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-sm font-medium">New workspace</span>
                            </button>
                        </div>
                    )}

                    {/* New org form */}
                    {tab === "new-org" && (
                        <form onSubmit={createOrg} className="space-y-3">
                            <button type="button" onClick={() => setTab("orgs")} className="flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text-primary) mb-1">
                                <ChevronDown className="h-3 w-3 rotate-90" /> Back
                            </button>
                            <input
                                autoFocus
                                placeholder="Organization name"
                                value={orgForm.name}
                                onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                            />
                            <input
                                placeholder="First workspace name (e.g. General)"
                                value={orgForm.workspaceName}
                                onChange={(e) => setOrgForm((f) => ({ ...f, workspaceName: e.target.value }))}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                            />
                            {err && <p className="text-xs text-red-500">{err}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                Create organization
                            </button>
                        </form>
                    )}

                    {/* New workspace form */}
                    {tab === "new-ws" && (
                        <form onSubmit={createWorkspace} className="space-y-3">
                            <button type="button" onClick={() => setTab("workspaces")} className="flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text-primary) mb-1">
                                <ChevronDown className="h-3 w-3 rotate-90" /> Back
                            </button>
                            <p className="text-xs text-(--text-muted)">Adding to <strong>{currentOrg?.name}</strong></p>
                            <input
                                autoFocus
                                placeholder="Workspace name"
                                value={wsForm.name}
                                onChange={(e) => setWsForm({ name: e.target.value })}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                            />
                            {err && <p className="text-xs text-red-500">{err}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create workspace
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Desktop New-Workspace Popover ───────────────────────────────────────────
function NewWorkspacePopover() {
    const { currentOrg, accessToken, refreshOrganizations, switchWorkspace } = useApp();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    async function submit(e) {
        e.preventDefault();
        if (!name.trim()) { setErr("Name required"); return; }
        setLoading(true); setErr("");
        try {
            const ws = await apiRequest("/workspaces", {
                method: "POST", token: accessToken,
                body: { name: name.trim(), organizationId: currentOrg?.id },
            });
            await refreshOrganizations();
            switchWorkspace(ws.id);
            setName(""); setOpen(false);
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    if (!currentOrg) return null;

    return (
        <div ref={ref} className="relative">
            <button
                aria-label="New workspace"
                onClick={() => { setOpen((o) => !o); setErr(""); }}
                className="flex h-5 w-5 items-center justify-center rounded-md text-(--text-muted) hover:bg-(--bg-overlay) hover:text-indigo-600 transition-colors"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>

            {open && (
                <div className="absolute left-0 top-7 z-50 w-60 rounded-xl border border-(--border) bg-(--bg-elevated) p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold text-(--text-primary)">New workspace in {currentOrg.name}</p>
                    <form onSubmit={submit} className="space-y-2">
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Workspace name"
                            className="w-full rounded-lg border border-(--border) bg-(--bg) px-2.5 py-1.5 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                        />
                        {err && <p className="text-xs text-red-500">{err}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Create workspace
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

// ── TopBar ──────────────────────────────────────────────────────────────────
export function TopBar({ onMenuClick }) {
    const pathname = usePathname();
    const { currentOrg, currentWorkspace, accessToken } = useApp();
    const label = getLabel(pathname);

    const [searchOpen, setSearchOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [orgSheetOpen, setOrgSheetOpen] = useState(false);
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        function handler(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === "Escape") {
                setSearchOpen(false);
                setNotifOpen(false);
                setOrgSheetOpen(false);
            }
        }
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

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
                {/* Mobile: org/workspace switcher button */}
                <button
                    aria-label="Switch organization or workspace"
                    onClick={() => setOrgSheetOpen(true)}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-(--text-secondary) hover:bg-(--bg-overlay) transition-colors md:hidden"
                >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
                        {currentOrg?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="max-w-20 truncate text-xs font-medium">{currentOrg?.name || "No org"}</span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                </button>

                {/* Page title + workspace — desktop */}
                <div className="hidden md:flex flex-1 min-w-0 items-center gap-2">
                    <h1 className="text-sm font-semibold text-(--text-primary)">{label}</h1>
                    {currentWorkspace && (
                        <>
                            <span className="text-(--text-muted) text-sm">/</span>
                            <span className="text-sm text-(--text-muted) truncate max-w-32">{currentWorkspace.name}</span>
                        </>
                    )}
                    <NewWorkspacePopover />
                </div>

                {/* Page title — mobile (centered) */}
                <div className="flex flex-1 md:hidden" />

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                    {/* Search */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        aria-label="Search"
                        className="hidden sm:flex h-8 items-center gap-2 rounded-lg border border-(--border) bg-(--bg-sunken) px-3 text-xs text-(--text-muted) hover:border-(--border-strong) transition-colors"
                    >
                        <Search className="h-3.5 w-3.5" />
                        <span>Search...</span>
                        <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-(--border) bg-(--bg-overlay) px-1 py-0.5 text-[10px] sm:flex">
                            <Command className="h-2.5 w-2.5" />K
                        </kbd>
                    </button>
                    <button
                        aria-label="Search"
                        onClick={() => setSearchOpen(true)}
                        className="flex sm:hidden h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) transition-colors"
                    >
                        <Search className="h-4 w-4" />
                    </button>

                    {/* New */}
                    <Link
                        href="/issues"
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">New</span>
                    </Link>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            aria-label="View notifications"
                            onClick={() => setNotifOpen((o) => !o)}
                            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) transition-colors"
                        >
                            <Bell className="h-4 w-4" />
                            {unread > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-0.5 text-[9px] font-bold text-white">
                                    {unread > 9 ? "9+" : unread}
                                </span>
                            )}
                        </button>
                        <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
                    </div>
                </div>
            </header>

            <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
            <MobileOrgSheet open={orgSheetOpen} onClose={() => setOrgSheetOpen(false)} />
        </>
    );
}
