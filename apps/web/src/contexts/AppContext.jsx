"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
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
            const res = await fetch(`${API_URL}/auth/me`, {
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
        fetchOrgs(accessToken);
    }, [accessToken, fetchOrgs]);

    // Hydrate currentOrg/Workspace from localStorage once orgs are loaded
    useEffect(() => {
        if (!session?.user?.id || organizations.length === 0) return;

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

        setIsReady(true);
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
    }, [organizations, session?.user?.id]);

    const switchWorkspace = useCallback((workspaceId) => {
        setCurrentWorkspaceId(workspaceId);
        if (session?.user?.id) {
            localStorage.setItem(`flexflow:ws:${session.user.id}`, workspaceId);
        }
    }, [session?.user?.id]);

    const refreshOrganizations = useCallback(async () => {
        if (!accessToken) return;
        try {
            const res = await fetch(`${API_URL}/auth/me`, {
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
