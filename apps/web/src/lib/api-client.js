const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function apiRequest(path, { token, method = "GET", body, params } = {}) {
    const url = new URL(`${BASE_URL}${path}`);
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

    // Auto sign-out on 401 — token expired or invalid, force re-login
    if (res.status === 401) {
        if (typeof window !== "undefined") {
            // Dynamically import to avoid SSR issues
            import("next-auth/react").then(({ signOut }) => {
                signOut({ callbackUrl: "/login?error=session_expired" });
            });
        }
        throw new Error("Session expired — please sign in again");
    }

    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Request failed: ${res.status}`);
    }
    return json.data;
}
