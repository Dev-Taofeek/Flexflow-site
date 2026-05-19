"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { updateIssueStatus } from "@/lib/projects-api";
import { socket } from "@/lib/socket";

const columns = [
  {
    id: "TODO",
    title: "To Do",
  },
  {
    id: "IN_PROGRESS",
    title: "In Progress",
  },
  {
    id: "IN_REVIEW",
    title: "In Review",
  },
  {
    id: "DONE",
    title: "Done",
  },
];

const priorityVariantMap = {
  LOW: "secondary",
  MEDIUM: "secondary",
  HIGH: "destructive",
  URGENT: "destructive",
};

function groupIssuesByStatus(issues) {
  return columns.reduce((accumulator, column) => {
    accumulator[column.id] = issues.filter((issue) => issue.status === column.id);

    return accumulator;
  }, {});
}

function KanbanColumn({ column, issues, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <section
      ref={setNodeRef}
      className={[
        "border-border bg-surface dark:border-border-dark dark:bg-surface-dark min-h-140 rounded-3xl border p-4 transition-colors",
        isOver ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "",
      ].join(" ")}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-foreground dark:text-foreground-dark text-sm font-semibold">
          {column.title}
        </h2>

        <Badge variant="secondary">{issues.length}</Badge>
      </div>

      {children}
    </section>
  );
}

function IssueCard({ issue, isDragging = false }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: issue.id,
    data: {
      type: "issue",
      issue,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        "border-border bg-background dark:border-border-dark dark:bg-background-dark rounded-2xl border p-4 shadow-sm transition-all",
        isDragging ? "opacity-50" : "hover:border-brand-500/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-foreground dark:text-foreground-dark text-sm leading-5 font-medium">
            {issue.title}
          </h3>

          <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 line-clamp-2 text-xs leading-relaxed">
            {issue.description}
          </p>
        </div>

        <button
          type="button"
          className="text-muted-foreground hover:bg-muted hover:text-foreground dark:text-muted-foreground-dark dark:hover:bg-muted-dark dark:hover:text-foreground-dark cursor-grab rounded-md p-1 active:cursor-grabbing"
          aria-label={`Drag ${issue.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge variant={priorityVariantMap[issue.priority]}>{issue.priority}</Badge>

        <span className="text-muted-foreground dark:text-muted-foreground-dark truncate text-xs">
          {issue.assignee}
        </span>
      </div>
    </article>
  );
}

export function KanbanBoard({ projectId, initialIssues, token }) {
  const [issuesByStatus, setIssuesByStatus] = useState(() => groupIssuesByStatus(initialIssues));
  const [activeIssue, setActiveIssue] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const issueLookup = useMemo(() => {
    return Object.values(issuesByStatus)
      .flat()
      .reduce((accumulator, issue) => {
        accumulator[issue.id] = issue;

        return accumulator;
      }, {});
  }, [issuesByStatus]);

  useEffect(() => {
    socket.connect();
    socket.emit("project:join", projectId);

    function handleStatusUpdated(payload) {
      if (payload.projectId !== projectId) {
        return;
      }

      setIssuesByStatus((current) => {
        const next = Object.fromEntries(
          Object.entries(current).map(([status, issues]) => [
            status,
            issues.filter((issue) => issue.id !== payload.issue.id),
          ])
        );

        next[payload.issue.status] = [payload.issue, ...(next[payload.issue.status] || [])];

        return next;
      });
    }

    socket.on("issue:status-updated", handleStatusUpdated);

    return () => {
      socket.emit("project:leave", projectId);
      socket.off("issue:status-updated", handleStatusUpdated);
      socket.disconnect();
    };
  }, [projectId]);

  function findColumn(issueIdOrColumnId) {
    if (issuesByStatus[issueIdOrColumnId]) {
      return issueIdOrColumnId;
    }

    return Object.keys(issuesByStatus).find((status) =>
      issuesByStatus[status].some((issue) => issue.id === issueIdOrColumnId)
    );
  }

  function handleDragStart(event) {
    const issue = issueLookup[event.active.id];

    if (issue) {
      setActiveIssue(issue);
    }
  }

  function handleDragOver(event) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeColumn = findColumn(active.id);
    const overColumn = findColumn(over.id);

    if (!activeColumn || !overColumn || activeColumn === overColumn) {
      return;
    }

    setIssuesByStatus((current) => {
      const activeItems = current[activeColumn];
      const overItems = current[overColumn];

      const activeIndex = activeItems.findIndex((item) => item.id === active.id);

      const movedIssue = {
        ...activeItems[activeIndex],
        status: overColumn,
      };

      return {
        ...current,
        [activeColumn]: activeItems.filter((item) => item.id !== active.id),
        [overColumn]: [movedIssue, ...overItems],
      };
    });
  }

  async function handleDragEnd(event) {
    const { active, over } = event;

    setActiveIssue(null);

    if (!over) {
      return;
    }

    const activeColumn = findColumn(active.id);
    const overColumn = findColumn(over.id);

    if (!activeColumn || !overColumn) {
      return;
    }

    if (activeColumn === overColumn) {
      setIssuesByStatus((current) => {
        const columnIssues = current[activeColumn];

        const oldIndex = columnIssues.findIndex((issue) => issue.id === active.id);
        const newIndex = columnIssues.findIndex((issue) => issue.id === over.id);

        if (oldIndex === -1 || newIndex === -1) {
          return current;
        }

        return {
          ...current,
          [activeColumn]: arrayMove(columnIssues, oldIndex, newIndex),
        };
      });

      return;
    }

    try {
      await updateIssueStatus({
        projectId,
        issueId: active.id,
        status: overColumn,
        token,
      });
    } catch (error) {
      setIssuesByStatus(groupIssuesByStatus(initialIssues));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnIssues = issuesByStatus[column.id] || [];

          return (
            <KanbanColumn key={column.id} column={column} issues={columnIssues}>
              <SortableContext
                items={columnIssues.map((issue) => issue.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {columnIssues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </div>
              </SortableContext>
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay>{activeIssue ? <IssueCard issue={activeIssue} isDragging /> : null}</DragOverlay>
    </DndContext>
  );
}
