import { prisma } from "./prisma.js";

/**
 * Builds a JSON-serializable snapshot of everything the organization owns:
 * org profile, members, workspaces, projects, tasks (assignees, comments,
 * labels), labels, automation rules, and connector mappings.
 *
 * Plain values only (ids + names/descriptions); timestamps stay as ISO strings
 * so the export opens cleanly in any JSON viewer or spreadsheet import.
 */
export async function buildOrgExport(organizationId) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            workspaces: {
                include: {
                    labels: true,
                    members: { include: { user: { select: { id: true, name: true, email: true } } } },
                    connectorMappings: true,
                    automationRules: true,
                    projects: {
                        include: {
                            tasks: {
                                include: {
                                    assignees: {
                                        include: { user: { select: { id: true, name: true, email: true } } },
                                    },
                                    comments: {
                                        include: { author: { select: { id: true, name: true, email: true } } },
                                    },
                                    labels: { include: { label: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!org) return null;

    // Prisma objects carry BigInt/Date shapes that may not survive JSON.stringify
    // cleanly — map everything to plain JSON-friendly values explicitly.
    return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        organization: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            description: org.description,
            plan: org.plan,
            subscriptionStatus: org.subscriptionStatus,
            customAddOns: org.customAddOns,
            createdAt: toIso(org.createdAt),
        },
        members: org.members.map((m) => ({
            id: m.id,
            role: m.role,
            createdAt: toIso(m.createdAt),
            user: pickUser(m.user),
        })),
        workspaces: org.workspaces.map((ws) => ({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            description: ws.description,
            createdAt: toIso(ws.createdAt),
            labels: ws.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
            workflowMembers: ws.members.map((m) => ({ role: m.role, ...pickUser(m.user) })),
            automationRules: ws.automationRules.map((rule) => ({
                id: rule.id,
                provider: rule.provider,
                trigger: rule.trigger,
                action: rule.action,
                actionConfig: rule.actionConfig,
                enabled: rule.enabled,
                createdAt: toIso(rule.createdAt),
            })),
            connectorMappings: ws.connectorMappings.map((cm) => ({
                id: cm.id,
                provider: cm.provider,
                externalResourceType: cm.externalResourceType,
                externalResourceId: cm.externalResourceId,
                projectId: cm.projectId,
                taskId: cm.taskId,
                config: cm.config,
            })),
            projects: ws.projects.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                visibility: p.visibility,
                color: p.color,
                createdAt: toIso(p.createdAt),
                tasks: p.tasks.map((task) => ({
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    dueDate: toIso(task.dueDate),
                    completedAt: toIso(task.completedAt),
                    createdAt: toIso(task.createdAt),
                    reportedBy: pickUser(task.createdBy),
                    assignees: task.assignees.map((a) => pickUser(a.user)),
                    labels: task.labels.map((tl) => ({ id: tl.label.id, name: tl.label.name, color: tl.label.color })),
                    comments: task.comments.map((c) => ({
                        id: c.id,
                        content: c.content,
                        author: pickUser(c.author),
                        createdAt: toIso(c.createdAt),
                    })),
                })),
            })),
        })),
    };
}

function toIso(value) {
    return value ? new Date(value).toISOString() : null;
}

function pickUser(user) {
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role ?? null };
}