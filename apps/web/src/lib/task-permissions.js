// Work states an assignee may move a task through; DONE is reserved for
// the assigner (task creator) and users with task-management rights.
// Mirrors the API's resolveTaskStatusAccess rules.
export const WORK_STATES = ["TODO", "IN_PROGRESS", "IN_REVIEW"];

export function isTaskAssignee(userId, task) {
    if (!userId || !task) return false;
    const ids = [
        task.assigneeId,
        ...(task.assignees || []).map((a) => a.userId || a.user?.id),
    ].filter(Boolean);
    return ids.includes(userId);
}

export function isTaskCreator(userId, task) {
    return Boolean(
        userId && task && (task.createdById === userId || task.createdBy?.id === userId)
    );
}

// Whether the current user may change this task's status at all.
export function canChangeTaskStatus(userId, task, canManageTasks) {
    return Boolean(
        canManageTasks || isTaskAssignee(userId, task) || isTaskCreator(userId, task)
    );
}

// Whether the current user may set `nextStatus` on this task.
export function canSetTaskStatus(userId, task, nextStatus, canManageTasks) {
    if (!canChangeTaskStatus(userId, task, canManageTasks)) return false;
    if (canManageTasks || isTaskCreator(userId, task) || !nextStatus) return true;
    return WORK_STATES.includes(nextStatus);
}