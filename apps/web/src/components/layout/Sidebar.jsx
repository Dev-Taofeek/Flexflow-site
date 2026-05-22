"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { apiRequest } from "@/lib/api-client";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Home,
  LayoutGrid,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  Users,
  Building2,
  Check,
  ChevronsUpDown,
  Sparkles,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import Image from "next/image";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "My Issues", href: "/issues", icon: ListTodo },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Team", href: "/team", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const SETTINGS_NAV = [{ label: "Settings", href: "/settings/profile", icon: Settings }];

function OrgSwitcher({ collapsed }) {
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-(--text-primary)">
                {currentOrg.name}
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
              Organizations
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
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-bold text-white">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 truncate text-(--text-primary)">{org.name}</span>
              {org.id === currentOrg.id && <Check className="h-3.5 w-3.5 text-indigo-500" />}
            </button>
          ))}
          <div className="mt-1 border-t border-(--border) pt-1">
            <Link
              href="/onboarding"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
            >
              <Plus className="h-4 w-4" />
              New organization
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceSwitcher({ collapsed }) {
  const { currentOrg, currentWorkspace, switchWorkspace, accessToken, refreshOrganizations } = useApp();
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
    if (!wsName.trim()) { setWsErr("Name required"); return; }
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
    } catch (err) {
      setWsErr(err.message);
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
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-(--bg-overlay)">
              <LayoutGrid className="h-3 w-3 text-(--text-muted)" />
            </div>
            <span className="flex-1 truncate text-xs font-medium text-(--text-secondary)">
              {currentWorkspace?.name || "Select workspace"}
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
              Workspaces
            </p>
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { switchWorkspace(ws.id); setOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-(--bg-overlay)"
            >
              <span className="flex-1 truncate text-(--text-primary)">{ws.name}</span>
              {currentWorkspace?.id === ws.id && <Check className="h-3.5 w-3.5 text-indigo-500" />}
            </button>
          ))}

          <div className="mt-1 border-t border-(--border) pt-1">
            {creating ? (
              <form onSubmit={handleCreateWorkspace} className="px-3 py-2 space-y-2">
                <input
                  autoFocus
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="Workspace name"
                  className="w-full rounded-lg border border-(--border) bg-(--bg) px-2.5 py-1.5 text-xs text-(--text-primary) focus:border-indigo-500 focus:outline-none"
                />
                {wsErr && <p className="text-[11px] text-red-500">{wsErr}</p>}
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    disabled={wsLoading}
                    className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {wsLoading ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setWsErr(""); }}
                    className="rounded-lg border border-(--border) px-2.5 py-1.5 text-xs text-(--text-secondary) hover:bg-(--bg-overlay)"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
              >
                <Plus className="h-4 w-4" />
                New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ item, collapsed, isActive }) {
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
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function UserMenu({ collapsed }) {
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
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
              {user?.name || "User"}
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
            <Settings className="h-4 w-4" /> Profile settings
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-danger-500 hover:bg-danger-50 flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }) {
  const pathname = usePathname();

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
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
            aria-label="Expand sidebar"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex w-full items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="flex-1 text-sm font-semibold text-(--text-primary)">FlexFlow</span>
            <button
              onClick={onToggle}
              className="flex h-6 w-6 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-(--bg-overlay) hover:text-(--text-primary)"
              aria-label="Collapse sidebar"
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
