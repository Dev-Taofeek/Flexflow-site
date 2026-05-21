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

    // On 401: the NextAuth JWT callback handles silent refresh automatically
    // on the next session read. Only sign out if the refresh token is also gone
    // (session.error === "RefreshAccessTokenError" set in AppContext).
    if (res.status === 401) {
        throw Object.assign(new Error("Unauthorized"), { status: 401 });
    }

    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Request failed: ${res.status}`);
    }
    return json.data;
}
