import { prisma } from "../lib/prisma.js";
import { isEmailConfigured, sendTransactionalEmail } from "./email.service.js";
import { notifyUser } from "./notification.service.js";

const USER_SELECT = { id: true, name: true, email: true };

function issueUrl(projectId, issueId) {
    const origin = process.env.CLIENT_ORIGIN || "";
    return `${origin}/projects/${projectId}/issues/${issueId}`;
}

async function sendIssueEmail(user, { subject, title, message, actionText, actionUrl }) {
    if (!isEmailConfigured() || !user?.email) return;

    await sendTransactionalEmail({
        to: user.email,
        subject,
        title,
        message,
        actionText,
        actionUrl,
        footer: "You're receiving this because this issue relates to you in FlexFlow.",
    }).catch((error) => {
        console.error("Issue email failed:", error.message);
    });
}

export async function notifyIssueUsers(userIds, issue, { actorId, title, message, type = "INFO", subject, actionText = "Open issue" }) {
    const ids = [...new Set((userIds || []).filter(Boolean).filter((id) => id !== actorId))];
    if (ids.length === 0 || !issue?.id || !issue?.projectId) return;

    const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: USER_SELECT,
    });
    const actionUrl = issueUrl(issue.projectId, issue.id);

    await Promise.all(users.map((user) =>
        Promise.all([
            notifyUser(user.id, { title, message, type, url: actionUrl }),
            sendIssueEmail(user, {
                subject: subject || title,
                title,
                message,
                actionText,
                actionUrl,
            }),
        ])
    ));
}

export async function notifyIssueParticipants(issueId, { actorId, title, message, type = "INFO", subject, actionText = "Open issue", extraUserIds = [], excludeUserIds = [] }) {
    const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: {
            id: true,
            projectId: true,
            title: true,
            createdById: true,
            assigneeId: true,
            assignees: { select: { userId: true } },
            comments: { select: { authorId: true } },
        },
    });
    if (!issue) return;

    const excluded = new Set(excludeUserIds);
    const participantIds = [
        issue.createdById,
        issue.assigneeId,
        ...issue.assignees.map((assignee) => assignee.userId),
        ...issue.comments.map((comment) => comment.authorId),
        ...extraUserIds,
    ].filter((id) => !excluded.has(id));

    await notifyIssueUsers(participantIds, issue, {
        actorId,
        title,
        message,
        type,
        subject,
        actionText,
    });
}
