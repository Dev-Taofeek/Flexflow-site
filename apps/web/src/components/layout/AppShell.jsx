"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileBottomTabs } from "@/components/layout/MobileBottomTabs";

export function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-(--bg)">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div
        style={{ paddingLeft: collapsed ? 56 : 232 }}
        className="flex min-h-screen flex-col pb-16 transition-[padding-left] duration-200 md:pb-0"
      >
        <TopBar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <MobileBottomTabs />
    </div>
  );
}
