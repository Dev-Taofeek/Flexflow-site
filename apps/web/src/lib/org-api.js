import { apiRequest } from "./api-client";

export async function fetchOrganization(orgId, token) {
    return apiRequest(`/organizations/${orgId}`, { token });
}

export async function updateOrganization(orgId, data, token) {
    return apiRequest(`/organizations/${orgId}`, { token, method: "PATCH", body: data });
}

export async function fetchOrgMembers(orgId, token) {
    return apiRequest(`/organizations/${orgId}/members`, { token });
}

export async function updateMemberRole(orgId, userId, role, token) {
    return apiRequest(`/organizations/${orgId}/members/${userId}/role`, { token, method: "PATCH", body: { role } });
}

export async function removeMember(orgId, userId, token) {
    return apiRequest(`/organizations/${orgId}/members/${userId}`, { token, method: "DELETE" });
}

export async function inviteToOrg(orgId, email, role, token) {
    return apiRequest(`/organizations/${orgId}/invite`, { token, method: "POST", body: { email, role } });
}

export async function fetchWorkspace(workspaceId, token) {
    return apiRequest(`/workspaces/${workspaceId}`, { token });
}

export async function updateWorkspace(workspaceId, data, token) {
    return apiRequest(`/workspaces/${workspaceId}`, { token, method: "PATCH", body: data });
}

export async function createWorkspace(data, token) {
    return apiRequest("/workspaces", { token, method: "POST", body: data });
}

export async function deleteWorkspace(workspaceId, token) {
    return apiRequest(`/workspaces/${workspaceId}`, { token, method: "DELETE" });
}
