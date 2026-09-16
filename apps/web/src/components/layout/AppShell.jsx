"use client";

import { useState, useSyncExternalStore } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileBottomTabs } from "@/components/layout/MobileBottomTabs";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { EnablePushBanner } from "@/components/notifications/EnablePushBanner";

const mdMediaQuery =
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)") : null;

function subscribeMd(callback) {
    mdMediaQuery.addEventListener("change", callback);
    return () => mdMediaQuery.removeEventListener("change", callback);
}

function getMdSnapshot() {
    return mdMediaQuery.matches;
}

const getMdServerSnapshot = () => false;

export function AppShell({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const isMd = useSyncExternalStore(subscribeMd, getMdSnapshot, getMdServerSnapshot);

    const sidebarWidth = isMd ? (collapsed ? 56 : 232) : 0;

    return (
        <div className="min-h-screen bg-(--bg)">
            <ScrollToTop />
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

            <div
                className="flex min-h-screen flex-col pb-16 transition-[padding-left] duration-200 md:pb-0"
                style={{ paddingLeft: sidebarWidth }}
            >
                <TopBar onMenuClick={() => setCollapsed((c) => !c)} />
                <EnablePushBanner />

                <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
                    <div className="mx-auto w-full max-w-7xl">{children}</div>
                </main>
            </div>

            <MobileBottomTabs />
        </div>
    );
}
