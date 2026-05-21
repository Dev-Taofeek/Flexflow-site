import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { loginSchema } from "@/lib/auth/schemas";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

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

// Called on every OAuth sign-in to upsert the user in our DB and get JWTs
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

export const authOptions = {
    session: { strategy: "jwt" },
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
        async jwt({ token, user, account, profile }) {
            // Credentials login — user object already has tokens
            if (user && account?.provider === "credentials") {
                token.id = user.id;
                token.accessToken = user.accessToken;
                token.refreshToken = user.refreshToken;
                token.onboarded = user.onboarded;
                token.organizations = user.organizations;
            }

            // OAuth (Google / GitHub) — upsert into our DB, get tokens
            if (account && (account.provider === "google" || account.provider === "github")) {
                const data = await oauthLogin({
                    email: user.email,
                    name: user.name,
                    image: user.image,
                });
                if (data) {
                    token.id = data.user.id;
                    token.accessToken = data.accessToken;
                    token.refreshToken = data.refreshToken;
                    token.onboarded = data.user.onboarded;
                    token.organizations = data.organizations || [];
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id;
                session.user.accessToken = token.accessToken;
                session.user.refreshToken = token.refreshToken;
                session.user.onboarded = token.onboarded;
                session.user.organizations = token.organizations || [];
            }
            return session;
        },
    },
};
