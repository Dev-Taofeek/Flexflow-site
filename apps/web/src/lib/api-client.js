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

export async function apiRequest(
    path,
    { token, method = "GET", body, params, toast = true, successMessage, headers: extraHeaders } = {}
) {
    const url = new URL(apiUrl(path));
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
        });
    }

    const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await res.text();
    let json;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        const message = res.status === 413
            ? "The uploaded image is too large. Please choose a smaller logo."
            : text || `Request failed: ${res.status}`;
        if (toast) emitToast(message, "error");
        throw new Error(message);
    }

    // A step-up 2FA challenge is a 401, but it is NOT an expired session — the
    // caller is expected to collect a code and retry the same request.
    const requiresTwoFactor = json?.requiresTwoFactor === true || json?.error?.code === "TWO_FACTOR_REQUIRED";
    const requiresTwoFactorSetup = json?.requiresTwoFactorSetup === true || json?.error?.code === "TWO_FACTOR_SETUP_REQUIRED";

    if (res.status === 401 && requiresTwoFactor) {
        const error = new Error(json.error?.message || "Two-factor authentication code required.");
        error.status = 401;
        error.code = "TWO_FACTOR_REQUIRED";
        error.requiresTwoFactor = true;
        throw error;
    }

    // On 401 otherwise: the NextAuth JWT callback handles silent refresh
    // automatically on the next session read. Only sign out if the refresh token
    // is also gone (session.error === "RefreshAccessTokenError" set in AppContext).
    if (res.status === 401) {
        const message = json.error?.message || "Session expired. Please sign in again.";
        if (toast) emitToast(message, "error");
        throw Object.assign(new Error(message), { status: 401, code: json.error?.code });
    }

    if (!res.ok || !json.success) {
        const message = json.error?.message || `Request failed: ${res.status}`;
        const error = new Error(message);
        error.status = res.status;
        error.code = json.error?.code;
        error.data = json.data;
        error.requiresTwoFactor = requiresTwoFactor;
        error.requiresTwoFactorSetup = requiresTwoFactorSetup;
        if (toast && !requiresTwoFactor) emitToast(message, "error");
        throw error;
    }

    const message = successMessage ?? successMessageFor(method, path);
    if (toast && message) emitToast(message, "success");
    return json.data;
}
