"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderKanban, Home, ListTodo, Settings, Users } from "lucide-react";

const tabs = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Issues", href: "/issues", icon: ListTodo },
  { label: "Team", href: "/team", icon: Users },
  { label: "Settings", href: "/settings/profile", icon: Settings },
];

export function MobileBottomTabs() {
  const pathname = usePathname();

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
              className={[
                "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors",
                isActive ? "text-indigo-600" : "text-(--text-muted) hover:text-(--text-secondary)",
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
