import { apiUrl } from "./api-url";

export async function fetchRolesData() {
  const response = await fetch(apiUrl("/roles"), {
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(error || "Failed to fetch roles");
  }

  return response.json();
}

export async function updatePermission({ role, resource, action, enabled }) {
  const response = await fetch(apiUrl("/roles"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
      resource,
      action,
      enabled,
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(error || "Failed to update permission");
  }

  return response.json();
}
