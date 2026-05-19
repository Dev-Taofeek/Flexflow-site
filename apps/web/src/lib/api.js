import { apiRequest } from "./api-client";

export async function fetchDashboardData(workspaceId, token) {
    return apiRequest("/dashboard", { token, params: { workspaceId } });
}
