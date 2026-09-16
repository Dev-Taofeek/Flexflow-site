import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { loginSchema } from "@/lib/auth/schemas";
import { apiUrl } from "@/lib/api-url";

// Slack OAuth (custom provider — Slack has no built-in in NextAuth v4).
function SlackProvider(options) {
  return {
    id: "slack",
    name: "Slack",
    type: "oauth",
    authorization: {
      url: "https://slack.com/oauth/v2/authorize",
      params: { scope: "identity.basic,identity.email", user_scope: "identity.basic,identity.email" },
    },
    token: "https://slack.com/api/oauth.v2.access",
    userinfo: {
      url: "https://slack.com/api/openid.connect.userInfo",
      async request(context) {
        const res = await fetch(context.url, {
          headers: { Authorization: `Bearer ${context.tokens.access_token}` },
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Slack user info request failed");
        return { ...json.sub, id: json.sub, email: json.email, name: json.name, image: json.picture };
      },
    },
    profile(profile) {
      return {
        id: profile.id,
        name: profile.name || profile.sub || "Slack user",
        email: profile.email,
        image: profile.image || profile.picture || null,
      };
    },
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    allowDangerousEmailAccountLinking: true,
  };
}

// Figma OAuth (custom provider — no built-in in NextAuth v4).
function FigmaProvider(options) {
  return {
    id: "figma",
    name: "Figma",
    type: "oauth",
    authorization: {
      url: "https://www.figma.com/oauth",
      params: { scope: "files:read" },
    },
    token: "https://www.figma.com/api/oauth/token",
    userinfo: {
      url: "https://api.figma.com/v1/me",
      async request(context) {
        const res = await fetch(context.url, {
          headers: { Authorization: `Bearer ${context.tokens.access_token}` },
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error || "Figma user info request failed");
        return { ...json, id: json.id, email: json.email, name: json.handle || json.email, image: json.img_url || null };
      },
    },
    profile(profile) {
      return {
        id: profile.id,
        name: profile.name || profile.handle || profile.email,
        email: profile.email,
        image: profile.image || null,
      };
    },
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    allowDangerousEmailAccountLinking: true,
  };
}

// Access token lifetime: 23h so refresh happens once a day max
const ACCESS_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

function compactToken(token) {
    const {
        accessToken,
        accessTokenExpiry,
        onboarded,
        sub,
        name,
        email,
        picture,
        error,
    } = token;

    return {
        sub,
        name,
        email,
        picture,
        accessToken,
        accessTokenExpiry,
        onboarded,
        ...(error ? { error } : {}),
    };
}

async function authorize(credentials) {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) return null;

    try {
        const res = await fetch(apiUrl("/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: parsed.data.email,
                password: parsed.data.password,
                ...(parsed.data.code ? { code: parsed.data.code } : {}),
            }),
        });

        if (!res.ok) return null;
        const json = await res.json();
        if (!json.success || !json.data) return null;

        const { user, accessToken, requiresTwoFactor } = json.data;
        // 2FA user without a code — no session until a valid TOTP code is supplied
        if (requiresTwoFactor) return null;

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.avatarUrl || null,
            accessToken,
            onboarded: user.onboarded,
        };
    } catch {
        return null;
    }
}

async function oauthLogin({ email, name, image }) {
    try {
        const res = await fetch(apiUrl("/auth/oauth"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-secret": process.env.INTERNAL_SECRET,
            },
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
        // Old cookies (before DB migration) still carry refreshToken — use it directly.
        // New cookies have no refreshToken; use the DB-backed userId path instead.
        const useLegacy = !!token.refreshToken;
        const res = await fetch(apiUrl("/auth/refresh"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(!useLegacy && { "x-internal-secret": process.env.INTERNAL_SECRET }),
            },
            body: JSON.stringify(useLegacy ? { refreshToken: token.refreshToken } : { userId: token.sub }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error("Refresh failed");

        return {
            ...compactToken(token),
            accessToken: json.data.accessToken,
            accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
            error: undefined,
        };
    } catch {
        // Refresh token is also expired — force re-login
        return { ...compactToken(token), error: "RefreshAccessTokenError" };
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
        SlackProvider({
            clientId: process.env.AUTH_SLACK_ID,
            clientSecret: process.env.AUTH_SLACK_SECRET,
        }),
        FigmaProvider({
            clientId: process.env.AUTH_FIGMA_ID,
            clientSecret: process.env.AUTH_FIGMA_SECRET,
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
                return compactToken(token);
            }

            // ── Initial credentials login ──────────────────────────────────
            if (user && account?.provider === "credentials") {
                return compactToken({
                    ...compactToken(token),
                    accessToken: user.accessToken,
                    accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
                    onboarded: user.onboarded,
                });
            }

            // ── OAuth login ────────────────────────────────────────────────
            if (account && ["google", "github", "slack", "figma"].includes(account.provider)) {
                const data = await oauthLogin({ email: user.email, name: user.name, image: user.image });
                if (data) {
                    return compactToken({
                        ...compactToken(token),
                        // Override OAuth provider's sub with our DB user ID
                        sub: data.user.id,
                        accessToken: data.accessToken,
                        accessTokenExpiry: Date.now() + ACCESS_TOKEN_TTL_MS,
                        onboarded: data.user.onboarded,
                    });
                }
            }

            // ── Subsequent requests: refresh if within 5 min of expiry ──────
            if (token.accessTokenExpiry && Date.now() < token.accessTokenExpiry - 5 * 60 * 1000) {
                return compactToken(token);
            }

            return refreshAccessToken(token);
        },

        async session({ session, token }) {
            if (token.error) session.error = token.error;
            if (session.user) {
                session.user.id = token.sub;
                session.user.accessToken = token.accessToken;
                session.user.onboarded = token.onboarded;
                // refreshToken intentionally omitted — stored in DB, not needed client-side
                // organizations intentionally omitted — fetched by AppContext from GET /auth/me
            }
            return session;
        },
    },
};
