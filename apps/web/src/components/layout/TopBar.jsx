"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, Building2, Check, ChevronDown, Command, CreditCard, LayoutGrid, Loader2, LogOut, Menu, Monitor, Plus, Search, Settings, Sparkles, User, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useRole } from "@/hooks/useRole";
import { useEntitlements } from "@/hooks/useEntitlements";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { SearchModal } from "@/components/search/SearchModal";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { useI18n } from "@/i18n";
import { Translated } from "@/lib/translate";

const PAGE_LABELS = {
    "/dashboard": "nav.dashboard",
    "/tasks":    "nav.tasks",
    "/projects": "nav.projects",
    "/team":     "nav.team",
    "/analytics": "nav.analytics",
    "/intelligence": "nav.intelligence",
    "/settings": "nav.settings",
};

function getLabel(pathname, t) {
    for (const [key, slot] of Object.entries(PAGE_LABELS)) {
        if (pathname === key || pathname.startsWith(`${key}/`)) return t(`shell.${slot}`);
    }
    if (pathname.startsWith("/projects/")) return t("shell.nav.projectBoard");
    return "FlexFlow";
}

// ── Mobile Org/Workspace Bottom Sheet ──────────────────────────────────────
function MobileOrgSheet({ open, onClose }) {
    const { t } = useI18n();
    const router = useRouter();
    const { organizations, currentOrg, currentWorkspace, switchOrg, switchWorkspace, accessToken, refreshOrganizations } = useApp();
    const { canCreateWorkspace } = useRole();
    const { addToast } = useToast();

    const [tab, setTab] = useState("orgs"); // "orgs" | "workspaces" | "new-org" | "new-ws"
    const [orgForm, setOrgForm] = useState({ name: "", workspaceName: "General" });
    const [wsForm, setWsForm] = useState({ name: "" });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    function openNewOrg() {
        setTab("new-org");
    }

    function openNewWorkspace() {
        setTab("new-ws");
    }

    async function createOrg(e) {
        e.preventDefault();
        if (!orgForm.name.trim()) { setErr(t("shell.error.nameRequired")); return; }
        setLoading(true); setErr("");
        try {
            await apiRequest("/organizations", {
                method: "POST", token: accessToken,
                body: { name: orgForm.name, workspaceName: orgForm.workspaceName || "General" },
            });
            await refreshOrganizations();
            setOrgForm({ name: "", workspaceName: "General" });
            setTab("orgs");
            addToast(t("shell.org.created"), "success");
        } catch (ex) { setErr(ex.message); addToast(ex.message, "error"); }
        finally { setLoading(false); }
    }

    async function createWorkspace(e) {
        e.preventDefault();
        if (!wsForm.name.trim()) { setErr(t("shell.error.nameRequired")); return; }
        setLoading(true); setErr("");
        try {
            await apiRequest("/workspaces", {
                method: "POST", token: accessToken,
                body: { name: wsForm.name, organizationId: currentOrg?.id },
            });
            await refreshOrganizations();
            setWsForm({ name: "" });
            setTab("workspaces");
            addToast(t("shell.workspace.created"), "success");
        } catch (ex) { setErr(ex.message); addToast(ex.message, "error"); }
        finally { setLoading(false); }
    }

    if (!open) return null;

    return (
        <>
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
                        {tab === "new-org" ? t("shell.org.newTitle") : tab === "new-ws" ? t("shell.workspace.newTitle") : tab === "workspaces" ? t("shell.workspace.picker") : t("shell.org.picker")}
                    </h2>
                    <button aria-label={t("shell.action.close")} onClick={onClose} className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-overlay)">
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
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700">
                                        {org.name[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-(--text-primary)"><Translated>{org.name}</Translated></p>
                                        <p className="text-xs text-(--text-muted)">
                                            {t(org.workspaces?.length === 1 ? "shell.org.workspaceCountOne" : "shell.org.workspaceCountMany", { count: org.workspaces?.length || 0 })}
                                        </p>
                                    </div>
                                    {currentOrg?.id === org.id && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                                </button>
                            ))}

                            {currentOrg && (
                                <button
                                    onClick={() => setTab("workspaces")}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-(--bg-overlay) mt-2 border-t border-(--border) pt-3"
                                >
                                    <LayoutGrid className="h-4 w-4 text-(--text-muted)" />
                                    <span className="text-sm text-(--text-secondary)">{t("shell.workspace.switchInOrg", { name: currentOrg.name })}</span>
                                    <ChevronDown className="h-3.5 w-3.5 ml-auto text-(--text-muted) -rotate-90" />
                                </button>
                            )}

                            <button
                                onClick={openNewOrg}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-brand-600 transition-colors hover:bg-brand-50 mt-1"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="text-sm font-medium">{t("shell.org.new")}</span>
                            </button>
                        </div>
                    )}

                    {/* Workspace list */}
                    {tab === "workspaces" && (
                        <div className="space-y-1">
                            <button onClick={() => setTab("orgs")} className="flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text-primary) mb-3">
                                <ChevronDown className="h-3 w-3 rotate-90" /> {t("shell.org.backTo")}
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
                                    <span className="flex-1 truncate text-sm text-(--text-primary)"><Translated>{ws.name}</Translated></span>
                                    {currentWorkspace?.id === ws.id && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                                </button>
                            ))}
                            {canCreateWorkspace && (
                                <button
                                    onClick={openNewWorkspace}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-brand-600 hover:bg-brand-50 mt-1"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="text-sm font-medium">{t("shell.workspace.new")}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* New org form */}
                    {tab === "new-org" && (
                        <form onSubmit={createOrg} className="space-y-3">
                            <button type="button" onClick={() => setTab("orgs")} className="flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text-primary) mb-1">
                                <ChevronDown className="h-3 w-3 rotate-90" /> {t("shell.action.back")}
                            </button>
                            <input
                                autoFocus
                                placeholder={t("shell.org.namePlaceholder")}
                                value={orgForm.name}
                                onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                            />
                            <input
                                placeholder={t("shell.workspace.firstNamePlaceholder")}
                                value={orgForm.workspaceName}
                                onChange={(e) => setOrgForm((f) => ({ ...f, workspaceName: e.target.value }))}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                            />
                            {err && <p className="text-xs text-red-500">{err}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                {t("shell.org.create")}
                            </button>
                        </form>
                    )}

                    {/* New workspace form */}
                    {tab === "new-ws" && (
                        <form onSubmit={createWorkspace} className="space-y-3">
                            <button type="button" onClick={() => setTab("workspaces")} className="flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text-primary) mb-1">
                                <ChevronDown className="h-3 w-3 rotate-90" /> {t("shell.action.back")}
                            </button>
                            <p className="text-xs text-(--text-muted)">{t("shell.workspace.addingTo")} <strong>{currentOrg?.name ? <Translated>{currentOrg.name}</Translated> : null}</strong></p>
                            <input
                                autoFocus
                                placeholder={t("shell.workspace.namePlaceholder")}
                                value={wsForm.name}
                                onChange={(e) => setWsForm({ name: e.target.value })}
                                className="w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                            />
                            {err && <p className="text-xs text-red-500">{err}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {t("shell.workspace.create")}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
        </>
    );
}

// ── Desktop New-Workspace Popover ───────────────────────────────────────────
function NewWorkspacePopover() {
    const { t } = useI18n();
    const { currentOrg, accessToken, refreshOrganizations, switchWorkspace } = useApp();
    const { canCreateWorkspace } = useRole();
    const { addToast } = useToast();
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
        if (!name.trim()) { setErr(t("shell.error.nameRequired")); return; }
        setLoading(true); setErr("");
        try {
            const ws = await apiRequest("/workspaces", {
                method: "POST", token: accessToken,
                body: { name: name.trim(), organizationId: currentOrg?.id },
            });
            await refreshOrganizations();
            switchWorkspace(ws.id);
            setName(""); setOpen(false);
            addToast(t("shell.workspace.created"), "success");
        } catch (ex) {
            setErr(ex.message);
            addToast(ex.message, "error");
        } finally {
            setLoading(false);
        }
    }

    if (!currentOrg || !canCreateWorkspace) return null;

    function handleOpenPopover() {
        setOpen((o) => !o);
        setErr("");
    }

    return (
        <div ref={ref} className="relative">
            <button
                aria-label={t("shell.workspace.new")}
                onClick={handleOpenPopover}
                className="flex h-5 w-5 items-center justify-center rounded-md text-(--text-muted) hover:bg-(--bg-overlay) hover:text-brand-600 transition-colors"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>

            {open && (
                <div className="absolute left-0 top-7 z-50 w-60 rounded-xl border border-(--border) bg-(--bg-elevated) p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold text-(--text-primary)">{t("shell.workspace.newIn", { name: currentOrg.name })}</p>
                    <form onSubmit={submit} className="space-y-2">
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("shell.workspace.namePlaceholder")}
                            className="w-full rounded-lg border border-(--border) bg-(--bg) px-2.5 py-1.5 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
                        />
                        {err && <p className="text-xs text-red-500">{err}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            {t("shell.workspace.create")}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

// ── Mobile profile menu (mirrors the sidebar footer UserMenu) ───────────────
function MobileUserMenu() {
    const { t } = useI18n();
    const { user } = useApp();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const initials = user?.name
        ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
        : "U";

    return (
        <div ref={ref} className="relative md:hidden">
            <button
                aria-label={t("shell.menu.profile")}
                onClick={() => setOpen((o) => !o)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white ring-2 ring-transparent transition-all hover:ring-(--border-strong)"
                title={user?.name || t("shell.menu.profile")}
            >
                {user?.image ? (
                    <Image
                        src={user.image}
                        alt={user.name || t("shell.menu.profile")}
                        width={1200}
                        height={480}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    initials
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-(--border) bg-(--bg-elevated) py-1 shadow-lg">
                    <div className="border-b border-(--border) px-3 py-2">
                        <p className="truncate text-sm font-medium text-(--text-primary)">{user?.name || t("shell.user.fallback")}</p>
                        <p className="truncate text-xs text-(--text-muted)">{user?.email}</p>
                    </div>
                    <Link
                        href="/profile"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                    >
                        <User className="h-4 w-4" /> {t("shell.menu.profile")}
                    </Link>
                    <Link
                        href="/settings/profile"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                    >
                        <Settings className="h-4 w-4" /> {t("shell.nav.settings")}
                    </Link>
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="text-danger-500 hover:bg-danger-50 flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                    >
                        <LogOut className="h-4 w-4" /> {t("shell.menu.signOut")}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── TopBar ──────────────────────────────────────────────────────────────────
export function TopBar({ onMenuClick }) {
    const { t } = useI18n();
    const pathname = usePathname();
    const { currentOrg, currentWorkspace } = useApp();
    const { unreadCount } = useNotifications();
    const { isFree, planName } = useEntitlements();
    const { isAdmin } = useRole();
    const label = getLabel(pathname, t);

    const [searchOpen, setSearchOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [orgSheetOpen, setOrgSheetOpen] = useState(false);
    const [prefsOpen, setPrefsOpen] = useState(false);

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
                setPrefsOpen(false);
            }
        }
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    return (
        <>
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-(--border) bg-(--bg-elevated)/80 backdrop-blur-md px-3 sm:px-5">
                {/* Mobile: org/workspace switcher button */}
                <button
                    aria-label={t("shell.orgSwitch.label")}
                    onClick={() => setOrgSheetOpen(true)}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-(--text-secondary) hover:bg-(--bg-overlay) transition-colors md:hidden"
                >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-100 text-[10px] font-bold text-brand-700">
                        {currentOrg?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="max-w-20 truncate text-xs font-medium">{currentOrg?.name ? <Translated>{currentOrg.name}</Translated> : t("shell.org.none")}</span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                </button>

                {/* Page title + workspace — desktop */}
                <div className="hidden md:flex flex-1 min-w-0 items-center gap-2">
                    <h1 className="text-sm font-semibold text-(--text-primary)">{label}</h1>
                    {currentWorkspace && (
                        <>
                            <span className="text-(--text-muted) text-sm">/</span>
                            <span className="text-sm text-(--text-muted) truncate max-w-32"><Translated>{currentWorkspace.name}</Translated></span>
                        </>
                    )}
                    <NewWorkspacePopover />
                </div>

                {/* Page title — mobile (centered) */}
                <div className="flex flex-1 md:hidden" />

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                    {/* Plan — owners/admins manage it in billing settings. */}
                    {isAdmin ? (
                        <Link
                            href="/settings/billing"
                            className={[
                                "hidden sm:flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                                isFree
                                    ? "border-brand-500/40 bg-brand-500/10 text-brand-500 hover:bg-brand-500/15"
                                    : "border-(--border) text-(--text-muted) hover:border-(--border-strong) hover:text-(--text-primary)",
                            ].join(" ")}
                            title={isFree ? t("shell.plan.upgrade") : t("shell.plan.manage")}
                        >
                            {isFree ? <Sparkles className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                            {isFree ? t("shell.plan.upgrade") : planName}
                        </Link>
                    ) : (
                        <span
                            className="hidden sm:flex h-8 items-center gap-1.5 rounded-lg border border-(--border) px-2.5 text-xs font-medium text-(--text-muted) opacity-70"
                            title={t("shell.plan.adminOnly")}
                        >
                            {isFree ? <Sparkles className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                            {isFree ? t("shell.plan.upgrade") : planName}
                        </span>
                    )}

                    {/* Search */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        aria-label={t("shell.search.label")}
                        className="hidden sm:flex h-8 items-center gap-2 rounded-lg border border-(--border) bg-(--bg-sunken) px-3 text-xs text-(--text-muted) hover:border-(--border-strong) transition-colors"
                    >
                        <Search className="h-3.5 w-3.5" />
                        <span>{t("shell.search.placeholder")}</span>
                        <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-(--border) bg-(--bg-overlay) px-1 py-0.5 text-[10px] sm:flex">
                            <Command className="h-2.5 w-2.5" />K
                        </kbd>
                    </button>
                    <button
                        aria-label={t("shell.search.label")}
                        onClick={() => setSearchOpen(true)}
                        className="flex sm:hidden h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) transition-colors"
                    >
                        <Search className="h-4 w-4" />
                    </button>

                    {/* New */}
                    <Link
                        href="/tasks"
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t("shell.action.new")}</span>
                    </Link>

                    {/* Appearance / accessibility */}
                    <button
                        aria-label={t("shell.appearance.label")}
                        onClick={() => setPrefsOpen(true)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) transition-colors"
                        title={t("shell.appearance.title")}
                    >
                        <Monitor className="h-4 w-4" />
                    </button>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            aria-label={t("shell.notif.view")}
                            onClick={() => setNotifOpen((o) => !o)}
                            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-(--text-tertiary) hover:bg-(--bg-overlay) transition-colors"
                        >
                            <Bell className="h-4 w-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-0.5 text-[9px] font-bold text-white">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>
                        <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
                    </div>

                    {/* Mobile: profile menu (same actions as the sidebar footer) */}
                    <MobileUserMenu />
                </div>
            </header>

            <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
            <MobileOrgSheet open={orgSheetOpen} onClose={() => setOrgSheetOpen(false)} />
            <SettingsDrawer open={prefsOpen} onOpenChange={setPrefsOpen} />
        </>
    );
}
