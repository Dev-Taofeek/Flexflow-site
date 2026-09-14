"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

import { apiUrl } from "@/lib/api-url";

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const { data: session, update: updateSession } = useSession();
    const [organizations, setOrganizations] = useState([]);
    const [currentOrgId, setCurrentOrgId] = useState(null);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
    const [isReady, setIsReady] = useState(false);

    const accessToken = session?.user?.accessToken || null;

    // Force sign-out when refresh token expires
    useEffect(() => {
        if (session?.error === "RefreshAccessTokenError") {
            signOut({ callbackUrl: "/login?error=session_expired" });
        }
    }, [session?.error]);

    // Fetch organizations from API — never stored in JWT to avoid 494 header-too-large errors
    const fetchOrgs = useCallback(async (token) => {
        if (!token) return;
        try {
            const res = await fetch(apiUrl("/auth/me"), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const json = await res.json();
            if (json.success) {
                setOrganizations(json.data.organizations || []);
            }
        } catch {}
    }, []);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        (async () => { await fetchOrgs(accessToken); })();
        return () => { cancelled = true; };
    }, [accessToken, fetchOrgs]);

    // Hydrate currentOrg/Workspace from localStorage the FIRST time orgs load for
    // a session. Runs once per login (guarded by hydratedUserRef) so later
    // refreshes (e.g. after creating an org) never clobber an explicit selection.
    const hydratedUserRef = useRef(null);
    useEffect(() => {
        if (!session?.user?.id || organizations.length === 0) return;
        if (hydratedUserRef.current === session.user.id) return;

        let cancelled = false;
        (async () => {
            const savedOrgId = localStorage.getItem(`flexflow:org:${session.user.id}`);
            const savedWsId  = localStorage.getItem(`flexflow:ws:${session.user.id}`);

            const orgExists  = organizations.find((o) => o.id === savedOrgId);
            const targetOrg  = orgExists || organizations[0];

            if (targetOrg) {
                setCurrentOrgId(targetOrg.id);
                const wsExists = targetOrg.workspaces?.find((w) => w.id === savedWsId);
                const targetWs = wsExists || targetOrg.workspaces?.[0];
                if (targetWs) setCurrentWorkspaceId(targetWs.id);
            }

            hydratedUserRef.current = session.user.id;
            setIsReady(true);
        })();
        return () => { cancelled = true; };
    }, [session?.user?.id, organizations]);

    const currentOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0] || null;
    const currentWorkspace =
        currentOrg?.workspaces?.find((w) => w.id === currentWorkspaceId) ||
        currentOrg?.workspaces?.[0] ||
        null;

    const switchOrg = useCallback((orgId) => {
        const org = organizations.find((o) => o.id === orgId);
        if (!org) return;
        setCurrentOrgId(orgId);
        const firstWs = org.workspaces?.[0];
        const wsId = firstWs?.id || null;
        setCurrentWorkspaceId(wsId);
        if (session?.user?.id) {
            localStorage.setItem(`flexflow:org:${session.user.id}`, orgId);
            if (wsId) localStorage.setItem(`flexflow:ws:${session.user.id}`, wsId);
        }
    }, [organizations, session]);

    // Select any org/workspace without validating against state — used right
    // after a refresh (e.g. a freshly created organization) when `organizations`
    // may not have re-rendered yet. Persists the same way switchOrg does.
    const selectOrganization = useCallback((orgId, workspaceId) => {
        setCurrentOrgId(orgId);
        const wsId = workspaceId || null;
        setCurrentWorkspaceId(wsId);
        if (session?.user?.id) {
            localStorage.setItem(`flexflow:org:${session.user.id}`, orgId);
            if (wsId) localStorage.setItem(`flexflow:ws:${session.user.id}`, wsId);
        }
    }, [session]);

    const switchWorkspace = useCallback((workspaceId) => {
        setCurrentWorkspaceId(workspaceId);
        if (session?.user?.id) {
            localStorage.setItem(`flexflow:ws:${session.user.id}`, workspaceId);
        }
    }, [session]);

const refreshOrganizations = useCallback(async () => {
        if (!accessToken) return;
        try {
            const res = await fetch(apiUrl("/auth/me"), {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) return;
            const json = await res.json();
            if (json.success) {
                setOrganizations(json.data.organizations || []);
                await updateSession({ onboarded: json.data.user.onboarded });
            }
        } catch {}
    }, [accessToken, updateSession]);

    return (
        <AppContext.Provider value={{
            organizations,
            currentOrg,
            currentWorkspace,
            currentOrgId:       currentOrg?.id || null,
            currentWorkspaceId: currentWorkspace?.id || null,
            accessToken,
            user:               session?.user || null,
            isReady,
            switchOrg,
            switchWorkspace,
            selectOrganization,
            refreshOrganizations,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp must be used inside AppProvider");
    return ctx;
}
