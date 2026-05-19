"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Clock3, MessageSquare, Plus, Tag, User2 } from "lucide-react";

import { RichTextEditor } from "@/components/issues/RichTextEditor";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { socket } from "@/lib/socket";

import { createIssueComment, createSubtask, updateIssue, updateSubtask } from "@/lib/issues-api";

const statuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function IssueDetailView({
  project,
  issue: initialIssue,
  comments: initialComments,
  activityLog: initialActivityLog,
  people,
  availableLabels,
}) {
  const [issue, setIssue] = useState(initialIssue);
  const [comments, setComments] = useState(initialComments);
  const [activityLog, setActivityLog] = useState(initialActivityLog);

  const [title, setTitle] = useState(initialIssue.title);
  const [description, setDescription] = useState(initialIssue.description);

  const [newComment, setNewComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");

  const completedSubtasks = useMemo(() => {
    return issue.subtasks.filter((subtask) => subtask.isCompleted).length;
  }, [issue.subtasks]);

  useEffect(() => {
    socket.connect();

    socket.emit("project:join", project.id);

    function handleIssueUpdated(payload) {
      if (payload.issue.id !== issue.id) {
        return;
      }

      setIssue(payload.issue);

      if (payload.activity) {
        setActivityLog((current) => [payload.activity, ...current]);
      }
    }

    function handleCommentCreated(payload) {
      if (payload.issueId !== issue.id) {
        return;
      }

      setComments((current) => [...current, payload.comment]);

      if (payload.activity) {
        setActivityLog((current) => [payload.activity, ...current]);
      }
    }

    socket.on("issue:updated", handleIssueUpdated);
    socket.on("issue:comment-created", handleCommentCreated);

    return () => {
      socket.emit("project:leave", project.id);

      socket.off("issue:updated", handleIssueUpdated);

      socket.off("issue:comment-created", handleCommentCreated);

      socket.disconnect();
    };
  }, [issue.id, project.id]);

  async function saveIssue(payload) {
    const response = await updateIssue({
      projectId: project.id,
      issueId: issue.id,
      payload,
    });

    setIssue(response.data);
  }

  async function handleTitleBlur() {
    if (title !== issue.title) {
      await saveIssue({
        title,
      });
    }
  }

  async function handleDescriptionSave() {
    if (description !== issue.description) {
      await saveIssue({
        description,
      });
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();

    if (!newComment.trim()) {
      return;
    }

    await createIssueComment({
      projectId: project.id,
      issueId: issue.id,
      body: newComment,
    });

    setNewComment("");
  }

  async function handleCreateSubtask(event) {
    event.preventDefault();

    if (!subtaskTitle.trim()) {
      return;
    }

    await createSubtask({
      projectId: project.id,
      issueId: issue.id,
      title: subtaskTitle,
    });

    setSubtaskTitle("");
  }

  async function handleToggleSubtask(subtask) {
    const updatedIssue = {
      ...issue,
      subtasks: issue.subtasks.map((item) => {
        if (item.id !== subtask.id) {
          return item;
        }

        return {
          ...item,
          isCompleted: !item.isCompleted,
        };
      }),
    };

    setIssue(updatedIssue);

    await updateSubtask({
      projectId: project.id,
      issueId: issue.id,
      subtaskId: subtask.id,
      payload: {
        isCompleted: !subtask.isCompleted,
      },
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{project.name}</Badge>

            <Badge variant="outline">{issue.status}</Badge>

            <Badge variant="outline">{issue.priority}</Badge>
          </div>

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={handleTitleBlur}
            className="mt-5 border-none bg-transparent px-0 text-4xl font-semibold tracking-tight shadow-none focus-visible:ring-0 dark:bg-transparent"
          />

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                Description
              </h2>

              <Button size="sm" onClick={handleDescriptionSave}>
                Save
              </Button>
            </div>

            <RichTextEditor value={description} onChange={setDescription} />
          </div>
        </section>

        <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
                Sub-tasks
              </h2>

              <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
                {completedSubtasks} of {issue.subtasks.length} completed
              </p>
            </div>

            <Badge variant="secondary">{issue.subtasks.length}</Badge>
          </div>

          <div className="mt-6 space-y-3">
            {issue.subtasks.map((subtask) => (
              <button
                key={subtask.id}
                type="button"
                onClick={() => handleToggleSubtask(subtask)}
                className="border-border bg-background hover:border-brand-500/40 dark:border-border-dark dark:bg-background-dark flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors"
              >
                <CheckCircle2
                  className={[
                    "h-5 w-5",
                    subtask.isCompleted
                      ? "text-emerald-500"
                      : "text-muted-foreground dark:text-muted-foreground-dark",
                  ].join(" ")}
                  strokeWidth={1.8}
                />

                <span
                  className={[
                    "text-sm",
                    subtask.isCompleted
                      ? "text-muted-foreground dark:text-muted-foreground-dark line-through"
                      : "text-foreground dark:text-foreground-dark",
                  ].join(" ")}
                >
                  {subtask.title}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleCreateSubtask} className="mt-5 flex gap-3">
            <Input
              value={subtaskTitle}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              placeholder="Add sub-task..."
            />

            <Button type="submit">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </section>

        <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
          <div className="flex items-center gap-3">
            <MessageSquare className="text-brand-500 h-5 w-5" strokeWidth={1.8} />

            <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Comments
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            {comments.map((comment) => (
              <article
                key={comment.id}
                className="border-border bg-background dark:border-border-dark dark:bg-background-dark rounded-2xl border p-5"
              >
                <div className="flex items-center gap-3">
                  <Avatar fallback={comment.author.slice(0, 2)} />

                  <div>
                    <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
                      {comment.author}
                    </p>

                    <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {comment.body}
                </p>
              </article>
            ))}
          </div>

          <form onSubmit={handleCommentSubmit} className="mt-6">
            <textarea
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              placeholder={`Reply with @mentions like @${people[0]}`}
              className="border-border bg-background focus:border-brand-500 dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark min-h-32 w-full rounded-2xl border px-4 py-3 text-sm transition-colors outline-none"
            />

            <div className="mt-4 flex justify-end">
              <Button type="submit">Send comment</Button>
            </div>
          </form>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
          <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
            Issue Details
          </h2>

          <div className="mt-6 space-y-5">
            <div>
              <div className="text-muted-foreground dark:text-muted-foreground-dark mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <Clock3 className="h-4 w-4" />
                Status
              </div>

              <select
                value={issue.status}
                onChange={async (event) => {
                  const status = event.target.value;

                  setIssue((current) => ({
                    ...current,
                    status,
                  }));

                  await saveIssue({
                    status,
                  });
                }}
                className="border-border bg-background dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark h-11 w-full rounded-xl border px-4 text-sm"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-muted-foreground dark:text-muted-foreground-dark mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <Tag className="h-4 w-4" />
                Priority
              </div>

              <select
                value={issue.priority}
                onChange={async (event) => {
                  const priority = event.target.value;

                  setIssue((current) => ({
                    ...current,
                    priority,
                  }));

                  await saveIssue({
                    priority,
                  });
                }}
                className="border-border bg-background dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark h-11 w-full rounded-xl border px-4 text-sm"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-muted-foreground dark:text-muted-foreground-dark mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <User2 className="h-4 w-4" />
                Assignee
              </div>

              <select
                value={issue.assignee}
                onChange={async (event) => {
                  const assignee = event.target.value;

                  setIssue((current) => ({
                    ...current,
                    assignee,
                  }));

                  await saveIssue({
                    assignee,
                  });
                }}
                className="border-border bg-background dark:border-border-dark dark:bg-background-dark dark:text-foreground-dark h-11 w-full rounded-xl border px-4 text-sm"
              >
                {people.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-muted-foreground dark:text-muted-foreground-dark mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <Calendar className="h-4 w-4" />
                Due Date
              </div>

              <Input
                type="date"
                value={issue.dueDate}
                onChange={async (event) => {
                  const dueDate = event.target.value;

                  setIssue((current) => ({
                    ...current,
                    dueDate,
                  }));

                  await saveIssue({
                    dueDate,
                  });
                }}
              />
            </div>

            <div>
              <div className="text-muted-foreground dark:text-muted-foreground-dark mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <Tag className="h-4 w-4" />
                Labels
              </div>

              <div className="flex flex-wrap gap-2">
                {availableLabels.map((label) => {
                  const active = issue.labels.includes(label);

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={async () => {
                        const labels = active
                          ? issue.labels.filter((item) => item !== label)
                          : [...issue.labels, label];

                        setIssue((current) => ({
                          ...current,
                          labels,
                        }));

                        await saveIssue({
                          labels,
                        });
                      }}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-border bg-background text-muted-foreground dark:border-border-dark dark:bg-background-dark dark:text-muted-foreground-dark",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
          <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
            Activity Log
          </h2>

          <div className="mt-6 space-y-5">
            {activityLog.map((activity) => (
              <div key={activity.id} className="relative pl-6">
                <div className="bg-brand-500 absolute top-2 left-0 h-2 w-2 rounded-full" />

                <p className="text-foreground dark:text-foreground-dark text-sm">
                  <span className="font-medium">{activity.actor}</span> {activity.action}
                </p>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  {new Date(activity.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
