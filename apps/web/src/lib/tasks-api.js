import { apiRequest } from "./api-client";

export async function fetchTask({ projectId, taskId, token }) {
    return apiRequest(`/projects/${projectId}/tasks/${taskId}`, { token });
}

export async function updateTask({ projectId, taskId, payload, token }) {
    return apiRequest(`/projects/${projectId}/tasks/${taskId}`, { token, method: "PATCH", body: payload });
}

export async function updateTaskStatus({ projectId, taskId, status, token }) {
    return apiRequest(`/projects/${projectId}/tasks/${taskId}/status`, { token, method: "PATCH", body: { status } });
}

export async function createTaskComment({ projectId, taskId, content, token }) {
    return apiRequest(`/projects/${projectId}/tasks/${taskId}/comments`, { token, method: "POST", body: { content } });
}
