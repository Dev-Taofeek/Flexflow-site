// Minimal OIDC client for the SSO add-on. Discovers endpoints from the
// provider's issuer URL (Google Workspace, Microsoft Entra, Okta, Auth0,
// Keycloak, etc.) and exchanges authorization codes for identity tokens.
export async function oidcDiscover(issuerUrl) {
    const base = String(issuerUrl || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("issuerUrl is required");
    const wellKnown = base.endsWith("/.well-known/openid-configuration")
        ? base
        : `${base}/.well-known/openid-configuration`;

    const res = await fetch(wellKnown, { headers: { Accept: "application/json" } });
    if (!res.ok) {
        throw new Error(`OIDC discovery failed (${res.status}) — check the IdP issuer URL`);
    }
    const doc = await res.json();
    if (!doc.authorization_endpoint || !doc.token_endpoint) {
        throw new Error("OIDC discovery returned no authorization/token endpoint");
    }
    return {
        issuer: doc.issuer,
        authorizationEndpoint: doc.authorization_endpoint,
        tokenEndpoint: doc.token_endpoint,
        userinfoEndpoint: doc.userinfo_endpoint || doc.userinfoEndpoint || null,
        jwksUri: doc.jwks_uri || null,
    };
}

export function buildAuthorizeUrl({ discovery, clientId, redirectUri, state, domainHint }) {
    const url = new URL(discovery.authorizationEndpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", state);
    if (domainHint) url.searchParams.set("hd", domainHint);
    return url.toString();
}

export async function exchangeCode({ discovery, clientId, clientSecret, redirectUri, code }) {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", redirectUri);
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);

    const res = await fetch(discovery.tokenEndpoint, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });
    if (!res.ok) {
        throw new Error(`Token exchange failed (${res.status})`);
    }
    return res.json();
}

export async function fetchUserInfo(discovery, accessToken) {
    if (!discovery.userinfoEndpoint) {
        throw new Error("IdP does not expose a userinfo endpoint");
    }
    const res = await fetch(discovery.userinfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        throw new Error(`User info request failed (${res.status})`);
    }
    return res.json();
}

export function emailFromUserInfo(info) {
    if (!info) return null;
    const email = info.email || info.upn || info.preferred_username;
    return typeof email === "string" && email.includes("@") ? email.toLowerCase() : null;
}

export function nameFromUserInfo(info) {
    if (!info) return "Team member";
    return info.name || info.displayName || info.preferred_username || info.given_name || "Team member";
}

export function domainFromEmail(email) {
    if (typeof email !== "string" || !email.includes("@")) return null;
    return email.split("@")[1]?.toLowerCase() || null;
}

export function isEmailVerified(info) {
    // Microsoft Entra/UPN style and missing flags default to true — most IdPs
    // only hand out userinfo for verified accounts; treat explicit false as unverified.
    if (info.email_verified === false || info.emailVerified === false) return false;
    return true;
}