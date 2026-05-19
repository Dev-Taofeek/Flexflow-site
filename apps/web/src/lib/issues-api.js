import { apiRequest } from "./api-client";

export async function fetchIssue({ projectId, issueId, token }) {
    return apiRequest(`/projects/${projectId}/issues/${issueId}`, { token });
}

export async function updateIssue({ projectId, issueId, payload, token }) {
    return apiRequest(`/projects/${projectId}/issues/${issueId}`, { token, method: "PATCH", body: payload });
}

export async function createIssueComment({ projectId, issueId, content, token }) {
    return apiRequest(`/projects/${projectId}/issues/${issueId}/comments`, { token, method: "POST", body: { content } });
}
