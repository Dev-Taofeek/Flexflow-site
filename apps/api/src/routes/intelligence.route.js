import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireOrgRole } from "../lib/permissions.js";
import { enforceFeature } from "../lib/entitlements.js";
import { recordIntelligenceUsage, getIntelligenceUsage } from "../lib/usage.js";
import { recordAudit, clientIpFrom } from "../lib/audit.js";
import { notifyUser } from "../services/notification.service.js";
import { successResponse, errorResponse } from "../utils/api-response.js";

const router = Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Team Intelligence — deterministic retrieval over org-scoped work data.
//
// Guarantees:
//   • Every answer cites sources (project/task/comment/activity/knowledge) and
//     never invents facts.
//   • Every result is RBAC-scoped: workspace membership gates content, org-wide
//     knowledge requires OWNER/ADMIN.
//   • Free users get an upsell-only response; PRO/CUSTOM obey daily query caps.
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

/** Build the org-scoped, user-visible corpus for a query. */
async function buildCorpus({ organizationId, user, queryTokens }) {
    const orgMembership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!orgMembership) return { corpus: [], orgAdmin: false };

    const canSeeAll = orgMembership.role === "OWNER" || orgMembership.role === "ADMIN";

    // Workspaces the user belongs to (or every workspace for org admins).
    const workspaceMemberships = await prisma.workspaceMember.findMany({
        where: { userId: user.id },
        select: { workspaceId: true },
    });
    const memberWorkspaceIds = new Set(workspaceMemberships.map((w) => w.workspaceId));

    const workspaces = await prisma.workspace.findMany({
        where: { organizationId },
        select: { id: true },
    });
    const visibleWorkspaceIds = workspaces
        .filter((w) => canSeeAll || memberWorkspaceIds.has(w.id))
        .map((w) => w.id);

    if (visibleWorkspaceIds.length === 0) return { corpus: [], orgAdmin: canSeeAll };

    const [projects, tasks, comments, activities, knowledge] = await Promise.all([
        prisma.project.findMany({
            where: { workspaceId: { in: visibleWorkspaceIds } },
            select: { id: true, workspaceId: true, name: true, description: true },
        }),
        prisma.task.findMany({
            where: { project: { workspaceId: { in: visibleWorkspaceIds } } },
            select: { id: true, projectId: true, title: true, description: true, status: true, assignee: { select: { name: true } } },
        }),
        prisma.comment.findMany({
            where: { task: { project: { workspaceId: { in: visibleWorkspaceIds } } } },
            select: { id: true, taskId: true, content: true, author: { select: { name: true } } },
        }),
        prisma.activityLog.findMany({
            where: { project: { workspaceId: { in: visibleWorkspaceIds } } },
            select: { id: true, projectId: true, action: true, createdAt: true, user: { select: { name: true } } },
        }),
        prisma.knowledgeEntry.findMany({
            where: {
                organizationId,
                ...(canSeeAll ? {} : { workspaceId: { in: visibleWorkspaceIds } }),
            },
            select: { id: true, workspaceId: true, title: true, content: true, sourceType: true, tags: true },
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
        const text = `${task.title} ${task.description || ""} ${task.status} ${task.assignee?.name || ""}`;
        const score = scoreDocument(queryTokens, text);
        if (score > 0) {
            corpus.push({
                sourceType: "task",
                sourceId: task.id,
                workspaceId: undefined,
                title: task.title,
                snippet: task.description || task.title,
                status: task.status,
                assignee: task.assignee?.name || null,
                score: Math.min(999, score + SOURCE_BOOST.task),
                createdAt: new Date(0),
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
                workspaceId: undefined,
                title: `Comment by ${comment.author?.name || "team member"}`,
                snippet: comment.content.length > 200 ? `${comment.content.slice(0, 200)}…` : comment.content,
                score: Math.min(999, score + SOURCE_BOOST.comment),
                createdAt: new Date(0),
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
                workspaceId: undefined,
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
                createdAt: new Date(0),
            });
        }
    }

    corpus.sort((a, b) => b.score - a.score);
    return { corpus, orgAdmin: canSeeAll };
}

// GET /api/intelligence/:orgId — feature check + today's usage for the UI.
router.get("/:orgId", async (req, res) => {
    try {
        const entitlements = await enforceFeature(req, res, req.params.orgId, "team_intelligence_limited");
        if (!entitlements) return;

        // CUSTOM users with the full add-on have unlimited queries.
        const fullAccess = entitlements.planId === "custom";
        const usage = await getIntelligenceUsage(req.params.orgId);

        const isMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: req.params.orgId, userId: req.user.id } },
        });
        if (!isMember) return res.status(403).json(errorResponse("FORBIDDEN", "Not a member"));

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

// POST /api/intelligence/query — run a query over org-scoped work data.
router.post("/query", async (req, res) => {
    try {
        const { organizationId, query } = req.body;
        if (!organizationId) return res.status(422).json(errorResponse("VALIDATION_ERROR", "organizationId is required"));
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
        const { corpus } = await buildCorpus({ organizationId, user: req.user, queryTokens });

        // Deterministic synthesis — every claim maps to a cited source.
        const sources = corpus.slice(0, 6).map((item) => ({
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            title: item.title,
            snippet: item.snippet,
            status: item.status ?? undefined,
            assignee: item.assignee ?? undefined,
            tags: item.tags ?? undefined,
            relevance: Math.min(100, Math.round((item.score / 1000) * 100)),
        }));

        let answer;
        if (sources.length === 0) {
            answer =
                "I couldn't find a relevant match in your organization's work data for that question. " +
                "Ask your Owner/Admin to save it as a knowledge entry so it becomes answerable next time.";
        } else {
            const top = sources[0];
            const knowledgeSources = sources.filter((s) => s.sourceType === "knowledge");
            if (knowledgeSources.length > 0) {
                const best = knowledgeSources[0];
                answer = `Based on ${best.title}, here is what the team has recorded: ${best.snippet}`;
            } else {
                const names = [...new Set(sources.map((s) => s.title).slice(0, 3))].join(", ");
                answer =
                    `Here's what I found across your team's work on "${query}": ` +
                    `${sources.length} relevant ${sources.length === 1 ? "record" : "records"}. ` +
                    `The most relevant is "${top.title}" (${Math.round(top.relevance)}% match). ` +
                    (sources.length > 1 ? `Related items: ${names}.` : ""); 
            }
        }

        await recordAudit({
            organizationId,
            actorId: req.user.id,
            action: "intelligence.query",
            resource: "intelligence",
            metadata: { query, resultCount: sources.length },
            ipAddress: clientIpFrom(req),
        });

        return res.status(200).json(successResponse({
            question: query,
            answer,
            sources,
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