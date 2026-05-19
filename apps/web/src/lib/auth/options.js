import Credentials from "next-auth/providers/credentials";
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

export const authOptions = {
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
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
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.accessToken = user.accessToken;
                token.refreshToken = user.refreshToken;
                token.onboarded = user.onboarded;
                token.organizations = user.organizations;
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
