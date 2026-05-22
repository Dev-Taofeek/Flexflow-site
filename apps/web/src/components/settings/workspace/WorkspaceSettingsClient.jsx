"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function WorkspaceSettingsClient() {
  const [columns, setColumns] = useState(["To Do", "In Progress", "In Review", "Done"]);

  const [labels, setLabels] = useState([
    {
      id: "label-1",
      name: "Security",
      color: "#ef4444",
    },
    {
      id: "label-2",
      name: "Frontend",
      color: "#6366f1",
    },
    {
      id: "label-3",
      name: "Backend",
      color: "#22c55e",
    },
  ]);

  const [newColumn, setNewColumn] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  function handleAddColumn(event) {
    event.preventDefault();

    if (!newColumn.trim()) {
      return;
    }

    setColumns((current) => [...current, newColumn.trim()]);
    setNewColumn("");
  }

  function handleRemoveColumn(column) {
    setColumns((current) => current.filter((item) => item !== column));
  }

  function handleAddLabel(event) {
    event.preventDefault();

    if (!newLabel.trim()) {
      return;
    }

    setLabels((current) => [
      ...current,
      {
        id: `label-${Date.now()}`,
        name: newLabel.trim(),
        color: "#6366f1",
      },
    ]);

    setNewLabel("");
  }

  function handleRemoveLabel(labelId) {
    setLabels((current) => current.filter((label) => label.id !== labelId));
  }

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-11 w-11 items-center justify-center rounded-2xl">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="6" height="6" rx="1" />
              <rect x="15" y="3" width="6" height="6" rx="1" />
              <rect x="9" y="15" width="6" height="6" rx="1" />
              <path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9" />
            </svg>
          </div>

          <div>
            <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Workflow columns
            </h2>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
              Customize the stages used by your Kanban board.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {columns.map((column) => (
            <div
              key={column}
              className="border-border bg-background dark:border-border-dark dark:bg-background-dark flex items-center justify-between rounded-2xl border p-4"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="text-muted-foreground dark:text-muted-foreground-dark h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="5" r="1" />
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="15" cy="5" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="15" cy="19" r="1" />
                </svg>

                <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
                  {column}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveColumn(column)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground dark:text-muted-foreground-dark dark:hover:bg-muted-dark dark:hover:text-foreground-dark rounded-md p-1 transition-colors"
                aria-label={`Remove ${column}`}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddColumn} className="mt-5 flex gap-3">
          <Input
            value={newColumn}
            onChange={(event) => setNewColumn(event.target.value)}
            placeholder="Add workflow column..."
          />

          <Button type="submit">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </Button>
        </form>
      </section>

      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-11 w-11 items-center justify-center rounded-2xl">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2H7a2 2 0 0 0-2 2v5l9.29 9.29a2 2 0 0 0 2.83 0l3.88-3.88a2 2 0 0 0 0-2.83z" />
              <circle cx="7.5" cy="7.5" r="1" />
            </svg>
          </div>

          <div>
            <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Labels
            </h2>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
              Create and manage issue labels for filtering work.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {labels.map((label) => (
            <div
              key={label.id}
              className="border-border bg-background dark:border-border-dark dark:bg-background-dark inline-flex items-center gap-2 rounded-full border px-3 py-2"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: label.color,
                }}
              />

              <span className="text-foreground dark:text-foreground-dark text-sm font-medium">
                {label.name}
              </span>

              <button
                type="button"
                onClick={() => handleRemoveLabel(label.id)}
                className="text-muted-foreground hover:text-danger-600 dark:text-muted-foreground-dark dark:hover:text-danger-400 transition-colors"
                aria-label={`Remove ${label.name}`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddLabel} className="mt-5 flex gap-3">
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Add label..."
          />

          <Button type="submit">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </Button>
        </form>
      </section>

      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <div>
          <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
            Integrations
          </h2>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
            Connect external tools to keep your workspace in sync.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark rounded-2xl border p-5">
            <div className="flex items-center gap-3">
              <svg
                className="text-brand-500 h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="14.5" y="2" width="4" height="8" rx="2" />
                <path d="M18.5 6H3" />
                <rect x="2" y="14.5" width="8" height="4" rx="2" />
                <path d="M6 18.5V3" />
                <rect x="14.5" y="14.5" width="4" height="4" rx="2" />
                <rect x="2" y="2" width="4" height="4" rx="2" />
              </svg>

              <div>
                <p className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                  Slack webhook
                </p>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  Send issue updates to a Slack channel.
                </p>
              </div>
            </div>

            <Input
              value={slackWebhook}
              onChange={(event) => setSlackWebhook(event.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="mt-4"
            />

            <Badge variant="secondary" className="mt-4">
              Not connected
            </Badge>
          </div>

          <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark rounded-2xl border p-5 opacity-75">
            <div className="flex items-center gap-3">
              <svg
                className="text-brand-500 h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                    GitHub sync
                  </p>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
                    Premium
                  </span>
                </div>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  Link commits and pull requests to issues.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <p className="font-semibold">Upgrade to unlock</p>
              <p className="mt-0.5">GitHub sync is available on the Premium plan.</p>
            </div>

            <Badge variant="secondary" className="mt-4">
              Not connected
            </Badge>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button">Save integrations</Button>
        </div>
      </section>
    </div>
  );
}
