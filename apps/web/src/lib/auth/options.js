import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { loginSchema } from "@/lib/auth/schemas";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// Access token lifetime: 23h so refresh happens once a day max
const ACCESS_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

async function authorize(credentials) {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) return null;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
        });

        if (!res.ok) return null;
        const json = await res.json();
        if (!json.success || !json.data) return null;

        const { user, accessToken, refreshToken, organizations } = json.data;
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.avatarUrl || null,
            accessToken,
            refreshToken,
            onboarded: user.onboarded,
            organizations: organizations || [],
        };
    } catch {
        return null;
    }
}

async function oauthLogin({ email, name, image }) {
    try {
        const res = await fetch(`${API_URL}/auth/oauth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name, avatarUrl: image }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (!json.success || !json.data) return null;
        return json.data;
    } catch {
        return null;
    }
}

async function refreshAccessToken(token) {
    try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error("Refresh failed");

        return {
            ...token,
            accessToken: json.data.accessToken,
            accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
            error: null,
        };
    } catch {
        // Refresh token is also expired — force re-login
        return { ...token, error: "RefreshAccessTokenError" };
    }
}

export const authOptions = {
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days — user stays logged in for a month
    },
    pages: { signIn: "/login" },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
        }),
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize,
        }),
    ],
    callbacks: {
        async jwt({ token, user, account, trigger, session }) {
            // ── session.update() — only update lightweight fields ─────────
            if (trigger === "update" && session) {
                if (session.onboarded !== undefined) token.onboarded = session.onboarded;
                // Organizations are NOT stored in JWT to prevent 494 header-too-large errors.
                // AppContext fetches them from GET /auth/me using the accessToken.
                return token;
            }

            // ── Initial credentials login ──────────────────────────────────
            if (user && account?.provider === "credentials") {
                return {
                    ...token,
                    id: user.id,
                    accessToken: user.accessToken,
                    refreshToken: user.refreshToken,
                    accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
                    onboarded: user.onboarded,
                    error: null,
                };
            }

            // ── OAuth login ────────────────────────────────────────────────
            if (account && (account.provider === "google" || account.provider === "github")) {
                const data = await oauthLogin({ email: user.email, name: user.name, image: user.image });
                if (data) {
                    return {
                        ...token,
                        id: data.user.id,
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
                        onboarded: data.user.onboarded,
                        error: null,
                    };
                }
            }

            // ── Subsequent requests: refresh if within 5 min of expiry ──────
            if (token.accessTokenExpiry && Date.now() < token.accessTokenExpiry - 5 * 60 * 1000) {
                return token;
            }

            return refreshAccessToken(token);
        },

        async session({ session, token }) {
            session.error = token.error || null;
            if (session.user) {
                session.user.id = token.id;
                session.user.accessToken = token.accessToken;
                session.user.refreshToken = token.refreshToken;
                session.user.onboarded = token.onboarded;
                // organizations intentionally omitted — fetched by AppContext from API
            }
            return session;
        },
    },
};
