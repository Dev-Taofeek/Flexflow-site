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

export async function createIssue(projectId, data, token) {
    return apiRequest(`/projects/${projectId}/issues`, { token, method: "POST", body: data });
}

export async function updateIssueStatus({ projectId, issueId, status, token }) {
    return apiRequest(`/projects/${projectId}/issues/${issueId}/status`, { token, method: "PATCH", body: { status } });
}

export async function updateIssue({ projectId, issueId, token, ...data }) {
    return apiRequest(`/projects/${projectId}/issues/${issueId}`, { token, method: "PATCH", body: data });
}
