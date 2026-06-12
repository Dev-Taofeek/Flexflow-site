import { apiRequest } from "./api-client";

export async function fetchProjects({ workspaceId, search, visibility, sort, token } = {}) {
    return apiRequest("/projects", { token, params: { workspaceId, search, visibility, sort } });
}

export async function fetchProject(projectId, token) {
    return apiRequest(`/projects/${projectId}`, { token });
}

export async function createProject(data, token) {
    return apiRequest("/projects", { token, method: "POST", body: data });
}

export async function updateProject(projectId, data, token) {
    return apiRequest(`/projects/${projectId}`, { token, method: "PATCH", body: data });
}

export async function deleteProject(projectId, token) {
    return apiRequest(`/projects/${projectId}`, { token, method: "DELETE" });
}

export async function createTask(projectId, data, token) {
    return apiRequest(`/projects/${projectId}/tasks`, { token, method: "POST", body: data });
}

export async function updateTaskStatus({ projectId, taskId, status, token }) {
    return apiRequest(`/projects/${projectId}/tasks/${taskId}/status`, { token, method: "PATCH", body: { status } });
}
