import { apiUrl } from "./api-url";

function emitToast(message, type = "info") {
    if (typeof window === "undefined" || !message) return;
    window.dispatchEvent(new CustomEvent("flexflow:toast", { detail: { message, type } }));
}

function successMessageFor(method, path) {
    const action = method.toUpperCase();
    if (action === "GET") return null;
    if (action === "POST") return path.includes("invite") ? "Invitation sent." : "Saved successfully.";
    if (action === "PATCH" || action === "PUT") return "Updated successfully.";
    if (action === "DELETE") return "Deleted successfully.";
    return "Action completed.";
}

export async function apiRequest(path, { token, method = "GET", body, params, toast = true, successMessage } = {}) {
    const url = new URL(apiUrl(path));
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
        });
    }

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // On 401: the NextAuth JWT callback handles silent refresh automatically
    // on the next session read. Only sign out if the refresh token is also gone
    // (session.error === "RefreshAccessTokenError" set in AppContext).
    if (res.status === 401) {
        if (toast) emitToast("Session expired. Please sign in again.", "error");
        throw Object.assign(new Error("Unauthorized"), { status: 401 });
    }

    const json = await res.json();
    if (!res.ok || !json.success) {
        const message = json.error?.message || `Request failed: ${res.status}`;
        if (toast) emitToast(message, "error");
        throw new Error(message);
    }
    const message = successMessage ?? successMessageFor(method, path);
    if (toast && message) emitToast(message, "success");
    return json.data;
}
