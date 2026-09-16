// ─────────────────────────────────────────────────────────────────────────────
// FlexFlow Team Intelligence — deterministic, RBAC-scoped analytics tools.
//
// These are pure, side-effect-free helpers: they receive org-scoped, already
// RBAC-filtered task/project/activity data and return structured numbers and
// source citations. No LLM, no invented metrics, no division-by-zero. Every
// number is computed here in the backend so it can never be hallucinated.
// ─────────────────────────────────────────────────────────────────────────────

// Status literals map to the schema enums (TaskStatus.DONE / TaskStatus.BLOCKED).
export const DONE = "DONE";
export const BLOCKED_STATUS = "BLOCKED";
/** Legacy alias kept for callers/tests written against the old constant. */
export const COMPLETED = DONE;
export const BLOCKED = BLOCKED_STATUS;
export const OVERDUE = "OVERDUE";
export const AT_RISK = "AT_RISK";

// ── Period math (UTC, deterministic) ─────────────────────────────────────────

/** Month boundaries for the month containing `at` (start inclusive, end exclusive). */
export function monthRange(at = new Date()) {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
    return { start, end };
}

/** The previous month relative to `at`. */
export function previousMonthRange(at = new Date()) {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    return { start, end };
}

/** Week boundaries (Monday–Monday) containing `at`. */
export function weekRange(at = new Date()) {
    const dow = at.getUTCDay(); // 0 = Sunday
    const mondayDiff = (dow + 6) % 7;
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - mondayDiff));
    const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - mondayDiff + 7));
    return { start, end };
}

/** Safe percentage change. Previous==0 → null (never Infinity/NaN leaks). */
export function pctChange(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** Count items whose `field` date falls in `range`. */
export function countInRange(items, field, range) {
    const startT = range?.start?.getTime();
    const endT = range?.end?.getTime();
    return (items || []).filter((item) => {
        const t = item?.[field]?.getTime?.();
        if (!Number.isFinite(t)) return false;
        return t >= startT && t < endT;
    }).length;
}

// ── Blocked tasks ────────────────────────────────────────────────────────────

export function blockedTasks(tasks = []) {
    const blocked = tasks.filter((t) => t.status === BLOCKED);
    return {
        total: blocked.length,
        blocked,
        ids: blocked.map((t) => t.id),
        titles: blocked.map((t) => t.title),
    };
}

// ── Overdue tasks ────────────────────────────────────────────────────────────

export function overdueTasks(tasks = [], at = new Date()) {
    const now = at.getTime();
    return tasks.filter(
        (t) => t.dueDate && t.dueDate.getTime() < now && t.status !== DONE,
    );
}

// ── Workload per assignee ────────────────────────────────────────────────────

export function workloadByAssignee(tasks = [], userNameById = {}) {
    const counts = new Map(); // userId → open task count
    for (const t of tasks) {
        if (t.assigneeId) counts.set(t.assigneeId, (counts.get(t.assigneeId) || 0) + 1);
    }
    const byUser = [...counts.entries()]
        .map(([id, count]) => ({ id, name: userNameById[id] || "Unassigned", count }))
        .sort((a, b) => b.count - a.count);

    let imbalance = null;
    if (byUser.length >= 2) {
        const max = byUser[0].count;
        const min = byUser[byUser.length - 1].count;
        if (min > 0) imbalance = (max / min).toFixed(1); // e.g. "3.5"
    }
    return { byUser, total: tasks.length, imbalance, busiest: byUser[0]?.name || null };
}

// ── Created / completed per period with previous-period comparison ────────────

export function periodCompare(tasks = [], { currentRange, previousRange } = {}) {
    const created = {
        current: countInRange(tasks, "createdAt", currentRange),
        previous: countInRange(tasks, "createdAt", previousRange),
    };
    const completed = {
        current: tasks.filter(
            (t) => t.status === DONE && t.completedAt && countInRange([t], "completedAt", currentRange),
        ).length,
        previous: tasks.filter(
            (t) => t.status === DONE && t.completedAt && countInRange([t], "completedAt", previousRange),
        ).length,
    };
    return {
        created: { ...created, pct: pctChange(created.current, created.previous) },
        completed: { ...completed, pct: pctChange(completed.current, completed.previous) },
    };
}

// ── Productivity (completion/blocked rate) ───────────────────────────────────

export function productivityMetrics(tasks = []) {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === DONE).length;
    const blocked = tasks.filter((t) => t.status === BLOCKED).length;
    return {
        total,
        completed,
        blocked,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        blockedRate: total ? Math.round((blocked / total) * 100) : 0,
    };
}

// ── Project health / at-risk scoring (deterministic) ─────────────────────────

export function projectRisk(project, tasks = [], at = new Date()) {
    const pTasks = tasks.filter((t) => t.projectId === project.id);
    const overdue = overdueTasks(pTasks, at).length;
    const blocked = pTasks.filter((t) => t.status === BLOCKED).length;
    const total = pTasks.length;
    // Simple deterministic score out of 100. Never uses LLM or random data.
    const overdueWeight = total ? (overdue / total) * 60 : 0;
    const blockedWeight = total ? (blocked / total) * 40 : 0;
    const score = Math.min(100, Math.round(overdueWeight + blockedWeight));
    return { projectId: project.id, name: project.name, total, overdue, blocked, riskScore: score };
}

export function atRiskProjects(projects = [], tasks = [], at = new Date()) {
    return projects
        .map((p) => projectRisk(p, tasks, at))
        .filter((p) => p.riskScore > 20)
        .sort((a, b) => b.riskScore - a.riskScore);
}

// ── Recent activity / history (for cited answers) ────────────────────────────

export function recentActivity(items = [], limit = 6) {
    return [...items]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
}


// ---------------------------------------------------------------------------
// Deterministic intent router + thin range/count/assignee wrappers.
// Every input string maps to the SAME intent every time (no LLM, no state).
// Returned intents mirror the service's INTENT_REQUIRES_CORPUS keys so the
// orchestrator can pick the right corpus; anything unrecognized is "general".
// ---------------------------------------------------------------------------

const INTENT_RULES = [
    [/created|since|new tasks?/, "created"],
    [/complet(ed|ion)/, "completed"],
    [/block(ed|ing)?|stuck/, "blocked"],
    [/overdue|\blate\b|behind schedule/, "overdue"],
    [/risk|at risk|health|healthy/, "risk"],
    [/workload|too much|overloaded|capacity/, "workload"],
    [/productiv|velocity|efficient/, "productivity"],
    [/compar|vs\.?|versus|last (month|week)/, "compare"],
    [/hist|recent|activit/, "history"],
    [/knowledge|decision|remember|tribal/, "knowledge"],
    [/general|anything|how are we/, "general"],
];

export function classifyIntent(query = "") {
    const q = String(query).toLowerCase();
    for (const [re, intent] of INTENT_RULES) {
        if (re.test(q)) return intent;
    }
    return "general";
}

/** Week of `at` (Monday-aligned UTC), same semantics as weekRange. */
export function previousWeekRange(at = new Date()) {
    const t = new Date(at.getTime() - 7 * 86400000);
    return weekRange(t);
}

/** Count items whose {field} falls inside {range}, zero-safe. */
export function countCreated(items = [], range) {
    return countInRange(items, "createdAt", range);
}

/** Count tasks completed inside {range} (status-verified, never invented). */
export function countCompleted(tasks = [], range) {
    return tasks.filter(
        (t) => t.status === DONE && t.completedAt && countInRange([t], "completedAt", range) === 1,
    ).length;
}

/** Assignee workload summary; tasks without an owner are excluded. */
export function workloadStats(tasks = [], userNameById = {}) {
    return workloadByAssignee(tasks, userNameById);
}


/**
 * Memory floor for Intelligence: anchored to the literal day the organization
 * was created. The organization's intelligence memory begins on the first day
 * the org existed and never reaches further back. Full history — no cap.
 */
export function orgMemoryRange(orgCreatedAt = new Date(), at = new Date()) {
    const created = new Date(orgCreatedAt);
    if (isNaN(created.getTime())) return { start: new Date(at), end: new Date(at) };
    return { start: created, end: new Date(at) };
}


/**

 * Workspace isolation: a corpus item that belongs to a workspace other than the

 * caller's active workspace is dropped. Items with no workspaceId (org-shared

 * knowledge) stay visible only to org admins. Guarantees cross-workspace detail

 * can never leak from one workspace's intelligence into another's.

 */
export function isolateCorpusToWorkspace(corpus = [], { activeWorkspaceId, canSeeAll } = {}) {

    if (!activeWorkspaceId) return corpus;

    const target = String(activeWorkspaceId);

    return corpus.filter((item) => {

        if (!item?.workspaceId) return canSeeAll;

        return String(item.workspaceId) === target;

    });

}
