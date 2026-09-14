"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { fetchDashboardData } from "@/lib/api";
import { useI18n } from "@/i18n";
import { MyTasksWidget } from "./components/MyTasksWidget";
import { RecentActivityFeed } from "./components/RecentActivityFeed";
import { ProjectProgressWidget } from "./components/ProjectProgressWidget";
import { UpcomingDeadlines } from "./components/UpcomingDeadlines";
import { DashboardSkeleton } from "./components/DashboardSkeleton";

export default function DashboardPage() {
  const { currentWorkspace, accessToken, isReady, user } = useApp();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isReady || !currentWorkspace?.id || !accessToken) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDashboardData(currentWorkspace.id, accessToken);
        if (!cancelled) setData(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentWorkspace?.id, accessToken, isReady]);

  if (loading || !isReady) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-(--text-primary)">{t("dashboard.somethingWentWrong")}</p>
        <p className="mt-1 text-sm text-(--text-muted)">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { myTasks = [], recentActivity = [], projectProgress = [], upcomingDeadlines = [] } = data;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wider text-brand-600 uppercase">
              {t("dashboard.welcomeBack")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-(--text-primary)">
              {user?.name
                ? t("dashboard.heroGreeting", { name: user.name.split(" ")[0] })
                : t("dashboard.heroFallbackTitle")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-(--text-secondary)">
              {t("dashboard.heroDescription")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t("dashboard.myTasksCount"), value: myTasks.length },
              { label: t("dashboard.projectsCount"), value: projectProgress.length },
              { label: t("dashboard.activityCount"), value: recentActivity.length },
              { label: t("dashboard.deadlinesCount"), value: upcomingDeadlines.length },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-(--border) bg-(--bg) p-4">
                <p className="text-xs text-(--text-muted)">{label}</p>
                <p className="mt-1.5 text-2xl font-semibold text-(--text-primary)">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <MyTasksWidget tasks={myTasks} />
        </div>
        <div className="xl:col-span-2">
          <RecentActivityFeed activities={recentActivity} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ProjectProgressWidget projects={projectProgress} />
        <UpcomingDeadlines deadlines={upcomingDeadlines} />
      </div>
    </div>
  );
}
