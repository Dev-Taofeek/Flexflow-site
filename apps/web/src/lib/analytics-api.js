import { apiRequest } from "./api-client";

export async function fetchAnalytics(workspaceId, token) {
    return apiRequest("/analytics", { token, params: { workspaceId } });
}
