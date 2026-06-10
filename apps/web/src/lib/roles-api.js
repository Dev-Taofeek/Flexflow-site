import { apiRequest } from "./api-client";

export async function fetchRolesData(workspaceId, token) {
  return apiRequest("/roles", { token, params: { workspaceId }, toast: false });
}

export async function updatePermission({ workspaceId, role, resource, action, enabled, token }) {
  return apiRequest("/roles", {
    token,
    method: "PATCH",
    body: { workspaceId, role, resource, action, enabled },
    successMessage: "Permission updated.",
  });
}
