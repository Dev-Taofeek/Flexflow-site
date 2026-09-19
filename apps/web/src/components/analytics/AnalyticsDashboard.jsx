"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n";

const chartColors = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  accent: "#06b6d4",
  success: "#22c55e",
  warning: "#f59e0b",
};

function ChartCard({ title, description, children }) {
  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
      <div>
        <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">{title}</h2>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
          {description}
        </p>
      </div>

      <div className="mt-6 h-80">{children}</div>
    </section>
  );
}

export function AnalyticsDashboard({ analytics }) {
  const { t } = useI18n();
  const {
    velocity = [],
    burndown = [],
    workload = [],
    cycleTime = [],
    summary = {},
  } = analytics || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
          <Badge variant="secondary">{t("analytics.velocity")}</Badge>

          <p className="text-foreground dark:text-foreground-dark mt-4 text-3xl font-semibold">
            {summary.tasksClosed ?? 0}
          </p>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
            {t("analytics.tasksClosed")}
          </p>
        </div>

        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
          <Badge variant="secondary">{t("analytics.cycleTime")}</Badge>

          <p className="text-foreground dark:text-foreground-dark mt-4 text-3xl font-semibold">
            {summary.averageCycleTime ?? "—"}
          </p>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
            {t("analytics.averageDeliveryTime")}
          </p>
        </div>

        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
          <Badge variant="secondary">{t("analytics.utilization")}</Badge>

          <p className="text-foreground dark:text-foreground-dark mt-4 text-3xl font-semibold">
            {summary.teamUtilization ?? "0%"}
          </p>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
            {t("analytics.teamWorkloadBalance")}
          </p>
        </div>

        <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
          <Badge variant="secondary">{t("analytics.sprint")}</Badge>

          <p className="text-foreground dark:text-foreground-dark mt-4 text-3xl font-semibold">
            {summary.sprintCompletion ?? "0%"}
          </p>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
            {t("analytics.sprintCompletionRate")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title={t("analytics.velocityChart")} description={t("analytics.velocityChartDescription")}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={velocity}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />

              <XAxis dataKey="week" stroke="#71717a" tickLine={false} axisLine={false} />

              <YAxis stroke="#71717a" tickLine={false} axisLine={false} />

              <Tooltip />

              <Legend />

              <Line
                type="monotone"
                dataKey="closed"
                stroke={chartColors.primary}
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />

              <Line
                type="monotone"
                dataKey="created"
                stroke={chartColors.secondary}
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t("analytics.burndownChart")}
          description={t("analytics.burndownChartDescription")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={burndown}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />

              <XAxis dataKey="day" stroke="#71717a" tickLine={false} axisLine={false} />

              <YAxis stroke="#71717a" tickLine={false} axisLine={false} />

              <Tooltip />

              <Legend />

              <Area
                type="monotone"
                dataKey="ideal"
                stroke={chartColors.success}
                fill={chartColors.success}
                fillOpacity={0.2}
                strokeWidth={2}
              />

              <Area
                type="monotone"
                dataKey="remaining"
                stroke={chartColors.warning}
                fill={chartColors.warning}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title={t("analytics.teamWorkload")}
          description={t("analytics.teamWorkloadDescription")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workload}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />

              <XAxis dataKey="member" stroke="#71717a" tickLine={false} axisLine={false} />

              <YAxis stroke="#71717a" tickLine={false} axisLine={false} />

              <Tooltip />

              <Legend />

              <Bar dataKey="todo" stackId="work" fill={chartColors.primary} radius={[4, 4, 0, 0]} />

              <Bar
                dataKey="inProgress"
                stackId="work"
                fill={chartColors.secondary}
                radius={[4, 4, 0, 0]}
              />

              <Bar
                dataKey="review"
                stackId="work"
                fill={chartColors.accent}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t("analytics.cycleTimeDistribution")}
          description={t("analytics.cycleTimeDistributionDescription")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={cycleTime}
                dataKey="tasks"
                nameKey="range"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={4}
              >
                {cycleTime.map((entry, index) => {
                  const colors = [
                    chartColors.primary,
                    chartColors.secondary,
                    chartColors.accent,
                    chartColors.success,
                    chartColors.warning,
                  ];

                  return <Cell key={entry.range} fill={colors[index % colors.length]} />;
                })}
              </Pie>

              <Tooltip />

              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
