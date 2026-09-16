import { prisma } from "./prisma.js";

const KEY_RE = /\b([A-Z]{2,10})-(\d{1,6})\b/gi;

/** Upper-case, alphanumeric workspace prefix (max 5 chars). Falls back to FLEX. */
export function keyPrefixFor(workspaceSlug = "") {
    const clean = String(workspaceSlug ?? "")
        .replace(/[^a-z0-9]/gi, "")
        .toUpperCase()
        .slice(0, 5);
    return clean || "FLEX";
}

/** Format a numeric sequence into a task key, e.g. FLEX-184. */
export function formatTaskKey(prefix, number) {
    const p = prefix ? String(prefix).toUpperCase() : "FLEX";
    return `${p}-${Number(number)}`;
}

/**
 * Extracts task keys (e.g. FLEX-184, TEAM-42) from free-form text such as PR
 * titles, branch names, commit messages, or Slack messages. Deterministic and
 * injectable-safe (only uppercase alphanumeric prefixes + digits match).
 */
export function extractTaskKeys(text = "", minSegment = 1) {
    const tokens = String(text || "");
    const found = new Set();
    for (const match of tokens.matchAll(KEY_RE)) {
        const [raw, prefix, number] = match;
        const numeric = parseInt(number, 10);
        if (!Number.isFinite(numeric)) continue;
        if (numeric < minSegment) continue;
        found.add(formatTaskKey(prefix, numeric));
    }
    return [...found];
}

/**
 * Fetches the next task key for a workspace. Sequence is derived from the
 * existing keys so re-creating deleted tasks never reuses a number.
 */
export async function nextTaskKey(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, slug: true, organization: { select: { slug: true } } },
    });
    if (!workspace) return null;

    const prefix = keyPrefixFor(workspace.slug || workspace.organization?.slug);

    const rows = await prisma.task.findMany({
        where: { workspaceId },
        select: { key: true },
    });

    let maxNumber = 0;
    for (const row of rows) {
        if (!row.key) continue;
        const match = /-(\d{1,6})$/.exec(row.key);
        if (match) {
            const n = parseInt(match[1], 10);
            if (Number.isFinite(n) && n > maxNumber) maxNumber = n;
        }
    }

    return formatTaskKey(prefix, maxNumber + 1);
}

/** Resolve a task key to a Task row scoped to a workspace (or org). */
export async function findTaskByKey(key, { workspaceId, organizationId } = {}) {
    if (!key) return null;
    const where = { key };
    if (workspaceId) where.workspaceId = workspaceId;
    return prisma.task.findFirst({
        where,
        include: {
            project: {
                include: {
                    workspace: { select: { id: true, organizationId: true } },
                },
            },
        },
    });
}