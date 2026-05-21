import { apiRequest } from "./api-client";

export const searchAll = ({ q, workspaceId, token }) =>
    apiRequest("/search", { token, params: { q, ...(workspaceId && { workspaceId }) } });
