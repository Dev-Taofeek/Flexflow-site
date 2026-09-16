"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/contexts/ToastContext";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Home,
  LayoutGrid,
  ListTodo,
  Lock,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  Users,
  Check,
  ChevronsUpDown,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import Image from "next/image";
import { useI18n } from "@/i18n";
import { Translated } from "@/lib/translate";

function LogoBadge({ logoUrl, label, fallback, size = "md", icon: Icon }) {
  const { t } = useI18n();
  const dimensions = size === "sm" ? "h-6 w-6 rounded-md" : size === "xs" ? "h-5 w-5 rounded" : "h-7 w-7 rounded-md";

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden ${dimensions} bg-brand-600 text-xs font-bold text-white`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={t("shell.org.logoAlt", { name: label })} fill className="object-cover" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 text-(--text-muted)" />
      ) : (
        fallback
      )}
    </div>
  );
}

function OrgSwitcher({ collapsed }) {
  const { t } = useI18n();
  const { organizations, currentOrg, switchOrg } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!currentOrg) return null;

  const initials = currentOrg.name.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
          "hover:bg-(--sidebar-item-hover-bg)",
          collapsed ? "justify-center px-2" : "",
        ].join(" ")}
      >
        <LogoBadge logoUrl={currentOrg.logoUrl} label={currentOrg.name} fallback={initials} />
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-(--text-primary)">
                <Translated>{currentOrg.name}</Translated>
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-(--text-muted)" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-xl border border-(--border) bg-(--bg-elevated) py-1 shadow-lg">
          <div className="px-3 py-1.5">
            <p className="text-[11px] font-medium tracking-wider text-(--text-muted) uppercase">
              {t("shell.org.picker")}
            </p>
          </div>
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                switchOrg(org.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-(--bg-overlay)"
            >
              <LogoBadge logoUrl={org.logoUrl} label={org.name} fallback={org.name.slice(0, 2).toUpperCase()} size="sm" />
              <span className="flex-1 truncate text-(--text-primary)"><Translated>{org.name}</Translated></span>
              {org.id === currentOrg.id && <Check className="h-3.5 w-3.5 text-brand-500" />}
            </button>
          ))}
          <div className="mt-1 border-t border-(--border) pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.location.href = "/onboarding";
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
            >
              <Plus className="h-4 w-4" />
              {t("shell.org.new")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceSwitcher({ collapsed }) {
  const { t } = useI18n();
  const { currentOrg, currentWorkspace, switchWorkspace, accessToken, refreshOrganizations } = useApp();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsLoading, setWsLoading] = useState(false);
  const [wsErr, setWsErr] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!currentOrg) return null;
  const workspaces = currentOrg.workspaces || [];

  async function handleCreateWorkspace(e) {
    e.preventDefault();
    if (!wsName.trim()) { setWsErr(t("shell.error.nameRequired")); return; }
    setWsLoading(true); setWsErr("");
    try {
      const ws = await apiRequest("/workspaces", {
        method: "POST",
        token: accessToken,
        body: { name: wsName.trim(), organizationId: currentOrg.id },
      });
      await refreshOrganizations();
      switchWorkspace(ws.id);
      setWsName(""); setCreating(false); setOpen(false);
      addToast(t("shell.workspace.created"), "success");
    } catch (err) {
      setWsErr(err.message);
      addToast(err.message, "error");
    } finally {
      setWsLoading(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
          "hover:bg-(--sidebar-item-hover-bg)",
          collapsed ? "justify-center" : "",
        ].join(" ")}
      >
        {!collapsed ? (
          <>
            <LogoBadge logoUrl={currentWorkspace?.logoUrl} label={currentWorkspace?.name || t("shell.workspace.label")} fallback={null} size="xs" icon={LayoutGrid} />
            <span className="flex-1 truncate text-xs font-medium text-(--text-secondary)">
              {currentWorkspace?.name ? <Translated>{currentWorkspace.name}</Translated> : t("shell.workspace.select")}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-(--text-muted)" />
          </>
        ) : (
          <LayoutGrid className="h-4 w-4 text-(--text-muted)" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-xl border border-(--border) bg-(--bg-elevated) py-1 shadow-lg">
          <div className="px-3 py-1.5">
            <p className="text-[11px] font-medium tracking-wider text-(--text-muted) uppercase">
              {t("shell.workspace.picker")}
            </p>
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { switchWorkspace(ws.id); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-(--bg-overlay)"
            >
              <LogoBadge logoUrl={ws.logoUrl} label={ws.name} fallback={null} size="xs" icon={LayoutGrid} />
              <span className="flex-1 truncate text-(--text-primary)"><Translated>{ws.name}</Translated></span>
              {currentWorkspace?.id === ws.id && <Check className="h-3.5 w-3.5 text-brand-500" />}
            </button>
          ))}

          <div className="mt-1 border-t border-(--border) pt-1">
            {creating ? (
              <form onSubmit={handleCreateWorkspace} className="px-3 py-2 space-y-2">
                <input
                  autoFocus
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder={t("shell.workspace.namePlaceholder")}
                  className="w-full rounded-lg border border-(--border) bg-(--bg) px-2.5 py-1.5 text-xs text-(--text-primary) focus:border-brand-500 focus:outline-none"
                />
                {wsErr && <p className="text-[11px] text-red-500">{wsErr}</p>}
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    disabled={wsLoading}
                    className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {wsLoading ? t("shell.workspace.creating") : t("shell.workspace.create")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setWsErr(""); }}
                    className="rounded-lg border border-(--border) px-2.5 py-1.5 text-xs text-(--text-secondary) hover:bg-(--bg-overlay)"
                  >
                    {t("shell.action.cancel")}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => {
                  setCreating(true);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
              >
                <Plus className="h-4 w-4" />
                {t("shell.workspace.new")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ item, collapsed, isActive }) {
  const { t } = useI18n();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={[
        "group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-100",
        isActive
          ? "bg-(--sidebar-item-active-bg) text-(--text-primary)"
          : "text-(--text-tertiary) hover:bg-(--sidebar-item-hover-bg) hover:text-(--text-secondary)",
        collapsed ? "justify-center px-2" : "",
      ].join(" ")}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed && item.locked && (
        <Lock className="h-3 w-3 shrink-0 text-(--text-tertiary)" aria-label={t("shell.nav.locked")} />
      )}
    </Link>
  );
}

function UserMenu({ collapsed }) {
  const { t } = useI18n();
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-(--sidebar-item-hover-bg)",
          collapsed ? "justify-center" : "",
        ].join(" ")}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {user?.image ? (
            <Image
              src={user.image}
              alt={user.name}
              width={1200}
              height={480}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-(--text-primary)">
              {user?.name || t("shell.user.fallback")}
            </p>
            <p className="truncate text-xs text-(--text-muted)">{user?.email}</p>
          </div>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-xl border border-(--border) bg-(--bg-elevated) py-1 shadow-lg">
          <div className="border-b border-(--border) px-3 py-2">
            <p className="text-sm font-medium text-(--text-primary)">{user?.name}</p>
            <p className="text-xs text-(--text-muted)">{user?.email}</p>
          </div>
          <Link
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
          >
            <Settings className="h-4 w-4" /> {t("shell.menu.profile")}
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

export function Sidebar({ collapsed, onToggle }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { can } = useEntitlements();

  const NAV = [
    { label: t("shell.nav.dashboard"), href: "/dashboard", icon: Home },
    { label: t("shell.nav.myTasks"), href: "/tasks", icon: ListTodo },
    { label: t("shell.nav.projects"), href: "/projects", icon: FolderKanban },
    { label: t("shell.nav.team"), href: "/team", icon: Users },
    { label: t("shell.nav.analytics"), href: "/analytics", icon: BarChart3, locked: !can("advanced_analytics") },
    { label: t("shell.nav.intelligence"), href: "/intelligence", icon: Sparkles, locked: !can("team_intelligence_limited") },
  ];

  const SETTINGS_NAV = [{ label: t("shell.nav.settings"), href: "/settings/profile", icon: Settings }];

  return (
    <aside
      style={{ width: collapsed ? 56 : 232 }}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-(--sidebar-border) bg-(--sidebar-bg) transition-[width] duration-200 md:flex"
    >
      {/* Logo / Org Switcher */}
      <div className="flex h-14 shrink-0 items-center border-b border-(--sidebar-border) px-2">
        {collapsed ? (
          <button
            onClick={onToggle}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white transition-colors hover:bg-brand-700"
            aria-label={t("shell.sidebar.expand")}
          >
            F
          </button>
        ) : (
          <div className="flex w-full items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              F
            </div>
            <span className="flex-1 text-sm font-semibold text-(--text-primary)">FlexFlow</span>
            <button
              onClick={onToggle}
              className="flex h-6 w-6 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-(--bg-overlay) hover:text-(--text-primary)"
              aria-label={t("shell.sidebar.collapse")}
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>
        )}
      </div>

      {/* Org + Workspace pickers */}
      {!collapsed && (
        <div className="space-y-0.5 border-b border-(--sidebar-border) px-2 py-2">
          <OrgSwitcher collapsed={collapsed} />
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
      )}
      {collapsed && (
        <div className="space-y-1 border-b border-(--sidebar-border) px-2 py-2">
          <OrgSwitcher collapsed />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
            }
          />
        ))}

        <div className="my-2 border-t border-(--border)" />

        {SETTINGS_NAV.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={pathname.startsWith("/settings")}
          />
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-(--sidebar-border) px-2 py-2">
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
