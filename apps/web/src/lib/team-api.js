import { apiRequest } from "./api-client";

export async function fetchTeamData(workspaceId, token) {
    return apiRequest("/team", { token, params: { workspaceId } });
}

export async function inviteMember({ workspaceId, email, role, token }) {
    return apiRequest("/team/invite", { token, method: "POST", body: { workspaceId, email, role } });
}

export async function updateMemberRole({ memberId, workspaceId, role, token }) {
    return apiRequest(`/team/members/${memberId}/role`, { token, method: "PATCH", body: { workspaceId, role } });
}

export async function removeMember({ memberId, workspaceId, token }) {
    return apiRequest(`/team/members/${memberId}?workspaceId=${workspaceId}`, { token, method: "DELETE" });
}
