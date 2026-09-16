import { prisma } from "../lib/prisma.js";
import { isEmailConfigured, sendTransactionalEmail } from "./email.service.js";
import { notifyUser } from "./notification.service.js";

const USER_SELECT = { id: true, name: true, email: true };

function taskUrl(projectId, taskId) {
    const origin = process.env.CLIENT_ORIGIN || "";
    return `${origin}/projects/${projectId}/tasks/${taskId}`;
}

async function sendTaskEmail(user, { subject, title, message, actionText, actionUrl }) {
    if (!isEmailConfigured() || !user?.email) return;

    await sendTransactionalEmail({
        to: user.email,
        subject,
        title,
        message,
        actionText,
        actionUrl,
        footer: "You're receiving this because this task relates to you in FlexFlow.",
    }).catch((error) => {
        console.error("Task email failed:", error.message);
    });
}

export async function notifyTaskUsers(userIds, task, { actorId, title, message, type = "INFO", subject, actionText = "Open task" }) {
    const ids = [...new Set((userIds || []).filter(Boolean).filter((id) => id !== actorId))];
    if (ids.length === 0 || !task?.id || !task?.projectId) return;

    const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: USER_SELECT,
    });
    const actionUrl = taskUrl(task.projectId, task.id);

    await Promise.all(users.map((user) =>
        Promise.all([
            notifyUser(user.id, { title, message, type, url: actionUrl }),
            sendTaskEmail(user, {
                subject: subject || title,
                title,
                message,
                actionText,
                actionUrl,
            }),
        ])
    ));
}

export async function notifyTaskParticipants(taskId, { actorId, title, message, type = "INFO", subject, actionText = "Open task", extraUserIds = [], excludeUserIds = [] }) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
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
    if (!task) return;

    const excluded = new Set(excludeUserIds);
    const participantIds = [
        task.createdById,
        task.assigneeId,
        ...task.assignees.map((assignee) => assignee.userId),
        ...task.comments.map((comment) => comment.authorId),
        ...extraUserIds,
    ].filter((id) => !excluded.has(id));

    await notifyTaskUsers(participantIds, task, {
        actorId,
        title,
        message,
        type,
        subject,
        actionText,
    });
}
