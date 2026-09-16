"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Activity } from "lucide-react";
import { useI18n } from "@/i18n";
import { Translated } from "@/lib/translate";

export function RecentActivityFeed({ activities }) {
  const { t } = useI18n();
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-2xl border p-6">
      <div>
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
          {t("dashboard.recentActivityTitle")}
        </h2>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
          {t("dashboard.recentActivitySubtitle")}
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-10 text-center dark:border-border-dark dark:bg-background-dark">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted dark:bg-muted-dark">
              <Activity className="text-muted-foreground dark:text-muted-foreground-dark h-5 w-5" />
            </div>
            <p className="text-foreground dark:text-foreground-dark mt-3 text-sm font-medium">
              {t("dashboard.noActivity")}
            </p>
            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
              {t("dashboard.noActivityHint")}
            </p>
          </div>
        ) : (
          <>
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative flex gap-4">
            {index !== activities.length - 1 ? (
              <span className="bg-border dark:bg-border-dark absolute top-10 left-5 h-full w-px" />
            ) : null}

            <Avatar
              fallback={activity.actor
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
              size="sm"
            />

            <div className="flex-1 pb-4">
              <p className="text-foreground dark:text-foreground-dark text-sm leading-relaxed">
                <span className="font-medium">{activity.actor}</span>{" "}
                <Translated>{activity.action} {activity.target}</Translated>
              </p>

              <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
          </>
        )}
      </div>
    </section>
  );
}
