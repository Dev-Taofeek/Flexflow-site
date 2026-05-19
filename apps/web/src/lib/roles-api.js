const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function fetchRolesData() {
  const response = await fetch(`${API_URL}/roles`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(error || "Failed to fetch roles");
  }

  return response.json();
}

export async function updatePermission({ role, resource, action, enabled }) {
  const response = await fetch(`${API_URL}/roles`, {
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
