"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SettingsLayout({ children }) {
    const pathname = usePathname();

    const NAV = [
        { href: "/settings/profile",      label: "Profile" },
        { href: "/settings/organization", label: "Organization" },
        { href: "/settings/workspace",    label: "Workspace" },
        { href: "/settings/roles",        label: "Roles & Permissions" },
    ];

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
