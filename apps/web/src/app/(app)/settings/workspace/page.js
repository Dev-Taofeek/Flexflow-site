import { WorkspaceSettingsClient } from "@/components/settings/workspace/WorkspaceSettingsClient";

export default function WorkspaceSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
        <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">
          Settings / Workspace
        </p>

        <h1 className="text-foreground dark:text-foreground-dark mt-2 text-3xl font-semibold tracking-tight">
          Workspace settings
        </h1>

        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-3 max-w-2xl text-sm leading-relaxed">
          Customize workflow columns, issue labels, and workspace integrations.
        </p>
      </section>

      <WorkspaceSettingsClient />
    </div>
  );
}
