"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { useRole } from "@/hooks/useRole";

export default function SettingsLayout({ children }) {
    const pathname = usePathname();
    const { role, isViewer, isAdmin, isOwner } = useRole();

    if (isViewer) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
                    <ShieldOff className="h-8 w-8 text-zinc-400" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-(--text-primary)">Access restricted</h2>
                <p className="mt-2 max-w-sm text-sm text-(--text-muted)">
                    Your role is <span className="font-medium text-(--text-secondary)">Viewer</span>. You can view content but
                    cannot access settings. Contact an Admin or Owner to change your role.
                </p>
            </div>
        );
    }

    const NAV = [
        { href: "/settings/profile",      label: "Profile",             show: true },
        { href: "/settings/organization", label: "Organization",        show: isAdmin },
        { href: "/settings/workspace",    label: "Workspace",           show: isAdmin },
        { href: "/settings/roles",        label: "Roles & Permissions", show: isAdmin },
    ].filter((n) => n.show);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-(--text-primary)">Settings</h1>
                <p className="mt-0.5 text-sm text-(--text-muted)">Manage your account and workspace preferences</p>
            </div>

            <nav className="flex gap-1 overflow-x-auto border-b border-(--border)" aria-label="Settings navigation">
                {NAV.map(({ href, label }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={[
                                "shrink-0 border-b-2 px-4 pb-3 pt-1 text-sm font-medium transition-colors",
                                active
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-(--text-muted) hover:text-(--text-primary)",
                            ].join(" ")}
                        >
                            {label}
                        </Link>
                    );
                })}
            </nav>

            <div>{children}</div>
        </div>
    );
}
