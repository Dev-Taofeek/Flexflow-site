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

export async function createRole({ workspaceId, name, description, permissions, token }) {
  return apiRequest("/roles", {
    token,
    method: "POST",
    body: { workspaceId, name, description, permissions },
    successMessage: "Role created.",
  });
}

export async function deleteRole({ workspaceId, roleId, token }) {
  return apiRequest(`/roles/${roleId}`, {
    token,
    method: "DELETE",
    body: { workspaceId },
    successMessage: "Role deleted.",
  });
}