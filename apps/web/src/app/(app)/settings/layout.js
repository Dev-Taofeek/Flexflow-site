"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useI18n } from "@/i18n";

export default function SettingsLayout({ children }) {
    const { t } = useI18n();
    const pathname = usePathname();
    const { role, isViewer, isAdmin, isOwner } = useRole();
    const { can } = useEntitlements();

    if (isViewer) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
                    <ShieldOff className="h-8 w-8 text-zinc-400" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-(--text-primary)">{t("shell.settings.accessRestricted")}</h2>
                <p className="mt-2 max-w-sm text-sm text-(--text-muted)">
                    {t("shell.settings.accessRestrictedBody", { role: t("shell.role.viewer") })}
                </p>
            </div>
        );
    }

    const NAV = [
        { href: "/settings/profile",      label: t("shell.settings.nav.profile"),      show: true },
        { href: "/settings/organization", label: t("shell.settings.nav.organization"), show: isAdmin },
        { href: "/settings/workspace",    label: t("shell.settings.nav.workspace"),    show: isAdmin },
        { href: "/settings/roles",        label: t("shell.settings.nav.roles"),        show: true },
        { href: "/settings/billing",      label: t("shell.settings.nav.billing"),      show: isAdmin },
        { href: "/settings/integrations", label: t("shell.settings.nav.integrations"), show: isAdmin },
        { href: "/settings/audit-logs",   label: t("shell.settings.nav.auditLogs"),    show: isAdmin && can("audit_logs") },
    ].filter((n) => n.show);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-(--text-primary)">{t("shell.nav.settings")}</h1>
                <p className="mt-0.5 text-sm text-(--text-muted)">{t("shell.settings.subtitle")}</p>
            </div>

            <nav className="flex gap-1 overflow-x-auto border-b border-(--border)" aria-label={t("shell.settings.navAria")}>
                {NAV.map(({ href, label }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={[
                                "shrink-0 border-b-2 px-4 pb-3 pt-1 text-sm font-medium transition-colors",
                                active
                                    ? "border-brand-600 text-brand-600"
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
