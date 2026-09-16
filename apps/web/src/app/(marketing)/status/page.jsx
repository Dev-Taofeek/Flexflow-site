import { ContentPage } from "@/components/marketing/ContentPage";
import { LiveText } from "@/components/LiveText";

const COMPONENTS = [
  {
    name: "Web app",
    description: "Dashboard, boards, projects, and settings",
    status: "Operational",
  },
  {
    name: "API",
    description: "REST API and realtime events",
    status: "Operational",
  },
  {
    name: "Realtime (WebSockets)",
    description: "Push updates and presence",
    status: "Operational",
  },
  {
    name: "Authentication",
    description: "Sign-in, 2FA, and password reset",
    status: "Operational",
  },
  {
    name: "Notifications",
    description: "Push and in-app notifications",
    status: "Operational",
  },
];

const INCIDENTS = [
  {
    date: "June 15, 2026",
    title: "No incidents recorded",
  },
];

export const metadata = {
  title: "Status",
  description: "Service availability and incident history for FlexFlow.",
};

export default function StatusPage() {
  return (
    <ContentPage
      eyebrow={<LiveText>Status</LiveText>}
      title={<LiveText>All systems operational.</LiveText>}
      description={
        <LiveText>Real-time availability for every part of the FlexFlow platform. Subscribe via the footer status pill or check back anytime.</LiveText>
      }
      narrow={true}
    >
      <div className="space-y-3">
        {COMPONENTS.map((component) => (
          <div
            key={component.name}
            className="flex items-center justify-between gap-4 rounded-xl border border-(--border) px-5 py-4"
          >
            <div>
              <p className="text-sm font-semibold text-(--text-primary)">
                <LiveText>{component.name}</LiveText>
              </p>
              <p className="mt-0.5 text-xs text-(--text-tertiary)">
                <LiveText>{component.description}</LiveText>
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-success-500">
              <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
              <LiveText>{component.status}</LiveText>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-(--text-primary)">
          <LiveText>Incident history</LiveText>
        </h2>
        <div className="mt-4 space-y-2">
          {INCIDENTS.map((incident) => (
            <p key={incident.date} className="text-sm text-(--text-tertiary)">
              <span className="font-medium text-(--text-secondary)">
                <LiveText>{incident.date}</LiveText>
              </span>{" "}
              <LiveText>{incident.title}</LiveText>
            </p>
          ))}
        </div>
      </div>
    </ContentPage>
  );
}