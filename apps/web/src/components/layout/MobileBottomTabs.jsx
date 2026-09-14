"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderKanban, Home, ListTodo, Settings, Users } from "lucide-react";
import { useI18n } from "@/i18n";

export function MobileBottomTabs() {
  const { t } = useI18n();
  const pathname = usePathname();

  const tabs = [
    { label: t("shell.nav.home"), href: "/dashboard", icon: Home },
    { label: t("shell.nav.projects"), href: "/projects", icon: FolderKanban },
    { label: t("shell.nav.tasks"), href: "/tasks", icon: ListTodo },
    { label: t("shell.nav.team"), href: "/team", icon: Users },
    { label: t("shell.nav.settings"), href: "/settings/profile", icon: Settings },
  ];

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-(--border) bg-(--bg-elevated)/95 px-1 pt-1 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "bg-brand-600/10 text-brand-600"
                  : "text-muted-foreground hover:text-secondary dark:text-muted-foreground-dark dark:hover:text-secondary dark:hover:text-foreground-dark",
              ].join(" ")}
            >
              <Icon className={["h-5 w-5", isActive ? "stroke-2" : "stroke-[1.5]"].join(" ")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
