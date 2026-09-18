import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

// OAuth application definitions for the three supported integrations. Scopes
// are kept intentionally minimal. Credentials are read from the environment so
// deployments without them simply hide the "Connect with …" button.
export const OAUTH_PROVIDERS = {
    github: {
        label: "GitHub",
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: "read:user repo",
        credentials: () => ({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }),
    },
    slack: {
        label: "Slack",
        authorizeUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        scopes: "channels:read,chat:write,team:read,users:read",
        credentials: () => ({ clientId: process.env.SLACK_CLIENT_ID, clientSecret: process.env.SLACK_CLIENT_SECRET }),
    },
    figma: {
        label: "Figma",
        authorizeUrl: "https://www.figma.com/oauth",
        tokenUrl: "https://api.figma.com/v1/oauth/token",
        scopes: "current_user:read,file_content:read",
        credentials: () => ({ clientId: process.env.FIGMA_CLIENT_ID, clientSecret: process.env.FIGMA_CLIENT_SECRET }),
    },
};

export function oauthConfigured(provider) {
    const config = OAUTH_PROVIDERS[provider];
    if (!config) return false;
    const { clientId, clientSecret } = config.credentials();
    return Boolean(clientId && clientSecret);
}

export function oauthCallbackUrl(provider) {
    const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, "");
    return `${base}/api/integrations/oauth/${provider}/callback`;
}

/** Signed, short-lived CSRF state binding the OAuth round-trip to org + user. */
export function signOAuthState({ provider, organizationId, userId }) {
    return jwt.sign({ provider, organizationId, userId, purpose: "integration-oauth" }, env.INTERNAL_SECRET, {
        expiresIn: "10m",
    });
}

export function verifyOAuthState(state) {
    const decoded = jwt.verify(state, env.INTERNAL_SECRET);
    if (decoded.purpose !== "integration-oauth") throw new Error("invalid state");
    return decoded;
}

export function buildAuthorizeUrl({ provider, state }) {
    const config = OAUTH_PROVIDERS[provider];
    const { clientId } = config.credentials();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: oauthCallbackUrl(provider),
        scope: config.scopes,
        state,
    });
    if (provider === "figma") params.set("response_type", "code");
    return `${config.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token and normalize the
 * account label. Returns `{ accessToken, account }`.
 */
export async function exchangeOAuthCode(provider, code) {
    const config = OAUTH_PROVIDERS[provider];
    const { clientId, clientSecret } = config.credentials();
    const redirectUri = oauthCallbackUrl(provider);

    const headers = { "Content-Type": "application/json", Accept: "application/json" };

    if (provider === "slack") {
        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
        });
        const res = await fetch(config.tokenUrl, { method: "POST", body });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Slack OAuth failed");
        return { accessToken: json.access_token, account: `workspace ${json.team?.name || ""}`.trim() };
    }

    if (provider === "figma") {
        const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        });
        const res = await fetch(config.tokenUrl, { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.access_token) throw new Error(json.error || "Figma OAuth failed");
        return { accessToken: json.access_token, account: null };
    }

    // GitHub
    const res = await fetch(config.tokenUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) throw new Error(json.error_description || json.error || "GitHub OAuth failed");
    return { accessToken: json.access_token, account: null };
}
