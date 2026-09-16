import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { enforceFeature } from "../lib/entitlements.js";
import { recordIntelligenceUsage, getIntelligenceUsage } from "../lib/usage.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { notifyUser } from "../services/notification.service.js";
import { runIntelligenceQuery } from "../services/intelligence.service.js";
import {
    classifyIntent,
    blockedTasks,
    overdueTasks,
    workloadByAssignee,
    productivityMetrics,
    periodCompare,
    atRiskProjects,
    recentActivity,
    weekRange,
    previousWeekRange,
    orgMemoryRange,
} from "../lib/intelligence-tools.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Team Intelligence — deterministic retrieval over workspace-scoped work data.
//
// Guarantees:
//   • Every answer cites sources and never invents facts.
//   • Every query is pinned to ONE active workspace; users must be a workspace
//     member OR an org OWNER/ADMIN (explicit grant). Org-wide knowledge entries
//     are visible only to OWNER/ADMIN.
//   • Metric numbers are always computed server-side from the workspace's full
//     task set; Groq may only rephrase them (see intelligence.service.js).
//   • Memory window spans org creation → now (full history, no cap).
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_BOOST = {
    knowledge: 100,
    task: 40,
    comment: 25,
    project: 20,
    activity: 5,
};

function tokenize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2);
}

/** Keyword-match score between a query and a document. */
function scoreDocument(queryTokens, text) {
    const haystack = String(text || "").toLowerCase();
    let matches = 0;
    for (const token of queryTokens) {
        if (haystack.includes(token)) matches += 1;
    }
    if (matches === 0) return 0;
    return Math.round((matches / queryTokens.length) * 1000);
}

/**
 * Resolves who may run intelligence against a workspace. Access rule:
 * workspace membership of ANY role, or the explicit org OWNER/ADMIN grant.
 */
async function resolveWorkspaceAccess({ organizationId, workspaceId, userId }) {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
            organization: { select: { id: true, createdAt: true } },
        },
    });
    if (!workspace || workspace.organizationId !== organizationId) return { ok: false };

    const orgMembership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
    });
    if (!orgMembership) return { ok: false };

    const canSeeAll = orgMembership.role === "OWNER" || orgMembership.role === "ADMIN";
    const wsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!wsMember && !canSeeAll) return { ok: false };

    return { ok: true, workspace, canSeeAll, orgRole: orgMembership.role, workspaceRole: wsMember?.role };
}

/**
 * Build the workspace-scoped corpus for a query. Also returns the complete
 * (already-visible) task/project set so analytics compute against ALL data the
 * caller is allowed to see — never just the keyword matches.
 */
async function buildCorpus({ organizationId, workspaceId, user, queryTokens }) {
    const access = await resolveWorkspaceAccess({ organizationId, workspaceId, userId: user.id });
    if (!access.ok) return { ok: false, corpus: [], canSeeAll: false, workspace: null };

    const knowledgeWhere = access.canSeeAll
        ? {
              organizationId,
              OR: [{ workspaceId }, { workspaceId: null }],
          }
        : { organizationId, workspaceId };

    const [projects, tasks, comments, activities, knowledge] = await Promise.all([
        prisma.project.findMany({
            where: { workspaceId },
            select: { id: true, workspaceId: true, name: true, description: true },
        }),
        prisma.task.findMany({
            where: { workspaceId },
            select: {
                id: true,
                projectId: true,
                workspaceId: true,
                key: true,
                title: true,
                description: true,
                status: true,
                assigneeId: true,
                createdAt: true,
                updatedAt: true,
                completedAt: true,
                dueDate: true,
                assignee: { select: { id: true, name: true } },
            },
        }),
        prisma.comment.findMany({
            where: { task: { workspaceId } },
            select: { id: true, taskId: true, content: true, createdAt: true, author: { select: { name: true } } },
        }),
        prisma.activityLog.findMany({
            where: { workspaceId },
            select: { id: true, projectId: true, taskId: true, action: true, createdAt: true, user: { select: { name: true } } },
        }),
        prisma.knowledgeEntry.findMany({
            where: knowledgeWhere,
            select: { id: true, workspaceId: true, title: true, content: true, sourceType: true, tags: true, createdAt: true },
        }),
    ]);

    const corpus = [];

    for (const project of projects) {
        const text = `${project.name} ${project.description || ""}`;
        const score = scoreDocument(queryTokens, text);
        if (score > 0) {
            corpus.push({
                sourceType: "project",
                sourceId: project.id,
                workspaceId: project.workspaceId,
                title: project.name,
                snippet: project.description || project.name,
                score: Math.min(999, score + SOURCE_BOOST.project),
                createdAt: new Date(0),
            });
        }
    }

    for (const task of tasks) {
        const text = `${task.key || ""} ${task.title} ${task.description || ""} ${task.status} ${task.assignee?.name || ""}`;
        const score = scoreDocument(queryTokens, text);
        if (score > 0) {
            corpus.push({
                sourceType: "task",
                sourceId: task.id,
                workspaceId: task.workspaceId,
                title: task.title,
                snippet: task.description || task.title,
                status: task.status,
                key: task.key,
                assignee: task.assignee?.name || null,
                score: Math.min(999, score + SOURCE_BOOST.task),
                createdAt: task.createdAt,
            });
        }
    }

    for (const comment of comments) {
        const text = `${comment.content} ${comment.author?.name || ""}`;
        const score = scoreDocument(queryTokens, text);
        if (score > 0) {
            corpus.push({
                sourceType: "comment",
                sourceId: comment.id,
                workspaceId,
                title: `Comment by ${comment.author?.name || "team member"}`,
                snippet: comment.content.length > 200 ? `${comment.content.slice(0, 200)}…` : comment.content,
                score: Math.min(999, score + SOURCE_BOOST.comment),
                createdAt: comment.createdAt,
            });
        }
    }

    for (const activity of activities) {
        const text = `${activity.action} ${activity.user?.name || ""}`;
        const score = scoreDocument(queryTokens, text);
        if (score > 0) {
            corpus.push({
                sourceType: "activity",
                sourceId: activity.id,
                workspaceId,
                title: `${activity.user?.name || "Someone"} ${activity.action}`,
                snippet: activity.action,
                score: Math.min(999, score + SOURCE_BOOST.activity),
                createdAt: activity.createdAt,
            });
        }
    }

    for (const entry of knowledge) {
        const text = `${entry.title} ${entry.content} ${(entry.tags || []).join(" ")}`;
        const score = scoreDocument(queryTokens, text);
        if (score > 0) {
            corpus.push({
                sourceType: "knowledge",
                sourceId: entry.id,
                workspaceId: entry.workspaceId,
                title: entry.title,
                snippet: entry.content.length > 220 ? `${entry.content.slice(0, 220)}…` : entry.content,
                tags: entry.tags,
                score: Math.min(999, score + SOURCE_BOOST.knowledge),
                createdAt: entry.createdAt,
            });
        }
    }

    corpus.sort((a, b) => b.score - a.score);
    return { ok: true, workspace: access.workspace, canSeeAll: access.canSeeAll, projects, tasks, comments, activities, knowledge, corpus };
}

/** Deterministic, metric-anchored answer. Numbers here are authoritative. */
function buildDeterministicAnswer({ intent, workspace, metrics }) {
    const parts = [];
    const { blocked, overdue, productivity, workload, compare, risk } = metrics;

    if (intent === "blocked") {
        parts.push(
            blocked.total
                ? `There are ${blocked.total} blocked task${blocked.total === 1 ? "" : "s"} in ${workspace.name}: ${blocked.titles.slice(0, 5).join(", ")}${blocked.total > 5 ? ` and ${blocked.total - 5} more` : ""}.`
                : `No blocked tasks right now in ${workspace.name}.`,
        );
    } else if (intent === "overdue") {
        parts.push(
            overdue.length
                ? `There are ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} (past due today) in ${workspace.name}: ${overdue.titles.slice(0, 5).join(", ")}${overdue.length > 5 ? ` and ${overdue.length - 5} more` : ""}.`
                : `Nothing is overdue in ${workspace.name} right now.`,
        );
    } else if (intent === "workload") {
        if (workload.byUser.length) {
            parts.push(`Open task workload in ${workspace.name}: ${workload.byUser.map((u) => `${u.name}: ${u.count}`).join("; ")}.`);
            if (workload.imbalance) parts.push(`Workload imbalance ratio: ${workload.imbalance}x between busiest and least-assigned.`);
        } else {
            parts.push(`There are no open assigned tasks in ${workspace.name} to report on.`);
        }
    } else if (intent === "created" || intent === "completed" || intent === "compare" || intent === "productivity") {
        parts.push(
            `${compare.created.current} task${compare.created.current === 1 ? "" : "s"} created this week vs ${compare.created.previous} last week${compare.created.pct !== null ? ` (${compare.created.pct >= 0 ? "+" : ""}${compare.created.pct}%)` : ""}.`,
        );
        parts.push(
            `${compare.completed.current} task${compare.completed.current === 1 ? "" : "s"} completed this week vs ${compare.completed.previous} last week${compare.completed.pct !== null ? ` (${compare.completed.pct >= 0 ? "+" : ""}${compare.completed.pct}%)` : ""}.`,
        );
        if (intent === "productivity") {
            parts.push(`Completion rate: ${productivity.completionRate}% of all ${productivity.total} tasks; ${productivity.blockedRate}% are blocked.`);
        }
    } else if (intent === "risk" || intent === "health") {
        if (risk.length) {
            parts.push(`Project health in ${workspace.name}: ${risk.map((p) => `${p.name} at ${p.riskScore}/100 risk (${p.overdue} overdue, ${p.blocked} blocked)`).join("; ")}.`);
        } else {
            parts.push(`No projects in ${workspace.name} are currently at risk.`);
        }
    } else if (intent === "history" || intent === "activity") {
        const recent = metrics.recent;
        parts.push(
            recent.length
                ? `Recent activity in ${workspace.name}: ${recent.slice(0, 5).map((a) => `${a.user?.name || "Someone"} ${a.action}`).join("; ")}.`
                : `No recent activity recorded in ${workspace.name}.`,
        );
    } else if (intent === "knowledge") {
        const entry = metrics.knowledge.find((k) => k) || null;
        parts.push(
            entry
                ? `From recorded decision memory: ${entry.title} — ${entry.content.slice(0, 220)}`
                : `No matching knowledge entry found; ask an OWNER/ADMIN to save one.`,
        );
    } else {
        parts.push(
            `${metrics.totalTasks} task${metrics.totalTasks === 1 ? "" : "s"} in ${workspace.name}: ${productivity.completed} completed, ${productivity.blocked} blocked, ${overdue.length} overdue across ${metrics.projectCount} project${metrics.projectCount === 1 ? "" : "s"}.`,
        );
        parts.push(`${compare.created.current} created and ${compare.completed.current} completed this week.`);
    }

    return parts.join(" ").trim();
}

/** Serialized metric summary included in query responses for the UI. */
function metricSummaryFor(metrics, memoryStart) {
    return {
        memoryStart: memoryStart?.toISOString?.() || null,
        totalTasks: metrics.totalTasks,
        completedTasks: metrics.productivity.completed,
        blockedTasks: metrics.blocked.total,
        overdueTasks: metrics.overdue.length,
        projectCount: metrics.projectCount,
        createdThisWeek: metrics.compare.created.current,
        completedThisWeek: metrics.compare.completed.current,
        workload: metrics.workload.byUser.slice(0, 5),
        atRisk: metrics.risk.slice(0, 5),
    };
}

// GET /api/intelligence/:orgId — feature check + today's usage for the UI.
// Membership is verified BEFORE the plan gate so the gate never leaks plan
// details to non-members.
router.get("/:orgId", async (req, res) => {
    try {
        const isMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!isMember) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member"));

        const entitlements = await enforceFeature(req, res, req.params.orgId, "team_intelligence_limited");
        if (!entitlements) return;

        const fullAccess = entitlements.planId === "custom";
        const usage = await getIntelligenceUsage(req.params.orgId);

        return res.status(200).json(successResponse({
            available: true,
            fullAccess,
            dailyLimit: entitlements.limits.teamIntelligenceQueriesPerDay,
            usage: {
                day: usage.day,
                queryCount: usage.queryCount,
                remaining: fullAccess ? Infinity : Math.max(0, entitlements.limits.teamIntelligenceQueriesPerDay - usage.queryCount),
            },
            upsell: false,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to load intelligence status"));
    }
});

// POST /api/intelligence/query — run a query over ONE workspace's work data.
// Follow-ups: pass the conversation via `history: [{role, content}, ...]`.
router.post("/query", async (req, res) => {
    try {
        const { organizationId, workspaceId, query, history = [] } = req.body;
        if (!organizationId || !workspaceId) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId and workspaceId are required"));
        }
        if (!query?.trim()) return res.status(422).json(errorResponse("VALIDATION_ERROR", "A question is required"));

        const isMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: req.user.id } },
        });
        if (!isMember) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member"));

        const entitlements = await enforceFeature(req, res, organizationId, "team_intelligence_limited");
        if (!entitlements) return;

        const fullAccess = entitlements.planId === "custom";
        const usage = await recordIntelligenceUsage(organizationId);
        if (!fullAccess && !usage.allowed) {
            return res.status(429).json(errorResponse(
                "QUERY_LIMIT_REACHED",
                `You've used your ${usage.limit} Team Intelligence queries for today.`,
            ));
        }

        const queryTokens = tokenize(query);
        const built = await buildCorpus({ organizationId, workspaceId, user: req.user, queryTokens });
        if (!built.ok) {
            return res.status(403).json(errorResponse("FORBIDDEN", "You don't have access to this workspace's intelligence"));
        }
        const { workspace, projects, tasks, comments, activities, knowledge, corpus } = built;

        // ── Analytics: computed over ALL task/project data the caller can see. ──
        const at = new Date();
        const currentWeek = weekRange(at);
        const previousWeek = previousWeekRange(at);
        const userNameById = Object.fromEntries(
            [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))].map((id) => {
                const t = tasks.find((x) => x.assigneeId === id);
                return [id, t?.assignee?.name || "Unassigned"];
            }),
        );

        const metrics = {
            totalTasks: tasks.length,
            projectCount: projects.length,
            blocked: blockedTasks(tasks),
            overdue: overdueTasks(tasks, at),
            productivity: productivityMetrics(tasks),
            workload: workloadByAssignee(tasks, userNameById),
            compare: periodCompare(tasks, { currentRange: currentWeek, previousRange: previousWeek }),
            risk: atRiskProjects(projects, tasks, at),
            recent: recentActivity(activities, 6),
            knowledge: knowledge.slice(0, 3),
        };

        const memoryRange = orgMemoryRange(workspace.organization.createdAt, at);
        const intent = classifyIntent(query);

        const deterministicAnswer = buildDeterministicAnswer({
            intent,
            workspace,
            metrics,
        });

        const sources = corpus.slice(0, 6).map((item) => ({
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            title: item.title,
            snippet: item.snippet,
            key: item.key ?? undefined,
            status: item.status ?? undefined,
            assignee: item.assignee ?? undefined,
            tags: item.tags ?? undefined,
            relevance: Math.min(100, Math.round((item.score / 1000) * 100)),
        }));

        // Groq (when configured) may only rephrase the authoritative answer.
        const synthesis = await runIntelligenceQuery({
            query: query.trim(),
            deterministicAnswer,
            sources,
            groqApiKey: env.GROQ_API_KEY,
            history,
            intent,
        });

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "intelligence.query",
            resource: "intelligence",
            metadata: { query, workspaceId, resultCount: sources.length, usedGroq: synthesis.usedGroq },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({
            question: query,
            answer: synthesis.answer,
            usedGroq: synthesis.usedGroq,
            workspaceId,
            workspaceName: workspace.name,
            sources,
            metrics: metricSummaryFor(metrics, memoryRange.start),
            usage: {
                queryCount: usage.count,
                remaining: fullAccess ? Infinity : Math.max(0, entitlements.limits.teamIntelligenceQueriesPerDay - usage.count),
            },
            dailyLimit: entitlements.limits.teamIntelligenceQueriesPerDay,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to run intelligence query"));
    }
});

// POST /api/intelligence/knowledge — save an org knowledge/decision entry.
router.post("/knowledge", requireOrgRole("OWNER", "ADMIN"), async (req, res) => {
    try {
        const { organizationId, workspaceId, title, content, sourceType = "DECISION", tags = [] } = req.body;
        if (!organizationId || !title?.trim() || !content?.trim()) {
            return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId, title and content are required"));
        }

        // Saving knowledge is part of the Decision Memory (CUSTOM) entitlement.
        const entitlements = await enforceFeature(req, res, organizationId, "team_intelligence_full");
        if (!entitlements) return;

        if (workspaceId) {
            const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
            if (!ws || ws.organizationId !== organizationId) {
                return res.status(422).json(errorResponse("VALIDATION_ERROR", "Invalid workspace"));
            }
        }

        const entry = await prisma.knowledgeEntry.create({
            data: {
                organizationId,
                workspaceId: workspaceId || null,
                createdById: req.user.id,
                title: title.trim(),
                content: content.trim(),
                sourceType,
                tags: Array.isArray(tags) ? tags.map((t) => String(t).slice(0, 40)) : [],
            },
        });

        await notifyUser(req.user.id, {
            title: "Knowledge saved",
            message: `"${entry.title}" was added to your decision memory.`,
            type: "SYSTEM",
        });

        return res.status(201).json(successResponse(entry));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to save knowledge entry"));
    }
});

// GET /api/intelligence/:orgId/snapshot?workspaceId= — real-time workspace
// health snapshot for the Intelligence dashboard.
router.get("/:orgId/snapshot", async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "workspaceId is required"));

        const entitlements = await enforceFeature(req, res, req.params.orgId, "team_intelligence_full");
        if (!entitlements) return;

        const access = await resolveWorkspaceAccess({
            organizationId: req.params.orgId,
            workspaceId,
            userId: req.user.id,
        });
        if (!access.ok) return res.status(403).json(errorResponse("FORBIDDEN", "You don't have access to this workspace"));

        const { workspace } = access;
        const at = new Date();
        const currentWeek = weekRange(at);
        const previousWeek = previousWeekRange(at);

        const [tasks, projects, activities, knowledgeCount, membersCount] = await Promise.all([
            prisma.task.findMany({
                where: { workspaceId },
                select: {
                    id: true, title: true, status: true, dueDate: true, completedAt: true,
                    createdAt: true, updatedAt: true, assigneeId: true,
                    assignee: { select: { id: true, name: true } },
                },
            }),
            prisma.project.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
            prisma.activityLog.findMany({
                where: { workspaceId },
                select: { id: true, action: true, createdAt: true, user: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 8,
            }),
            prisma.knowledgeEntry.count({
                where: access.canSeeAll
                    ? { organizationId: req.params.orgId, OR: [{ workspaceId }, { workspaceId: null }] }
                    : { organizationId: req.params.orgId, workspaceId },
            }),
            prisma.workspaceMember.count({ where: { workspaceId } }),
        ]);

        const userNameById = Object.fromEntries(
            [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))].map((id) => {
                const t = tasks.find((x) => x.assigneeId === id);
                return [id, t?.assignee?.name || "Unassigned"];
            }),
        );

        const compare = periodCompare(tasks, { currentRange: currentWeek, previousRange: previousWeek });

        return res.status(200).json(successResponse({
            workspaceId,
            workspaceName: workspace.name,
            counts: {
                tasks: tasks.length,
                projects: projects.length,
                blocked: blockedTasks(tasks).total,
                overdue: overdueTasks(tasks, at).length,
                completed: productivityMetrics(tasks).completed,
                members: membersCount,
                knowledge: knowledgeCount,
            },
            workload: workloadByAssignee(tasks, userNameById).byUser.slice(0, 5),
            projectHealth: atRiskProjects(projects, tasks, at).slice(0, 5),
            createdThisWeek: compare.created.current,
            completedThisWeek: compare.completed.current,
            recentActivity: activities.map((a) => ({ actor: a.user?.name || "Someone", action: a.action, at: a.createdAt })),
            memoryStart: workspace.organization.createdAt,
        }));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to load workspace snapshot"));
    }
});

// GET /api/intelligence/:orgId/usage — daily usage without querying.
router.get("/:orgId/usage", async (req, res) => {
    try {
        const isMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!isMember) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member"));
        const usage = await getIntelligenceUsage(req.params.orgId);
        return res.status(200).json(successResponse(usage));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorResponse("SERVER_ERROR", "Failed to load intelligence usage"));
    }
});

export { router as intelligenceRouter };