"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const { data: session, update: updateSession } = useSession();
    const [currentOrgId, setCurrentOrgId] = useState(null);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
    const [isReady, setIsReady] = useState(false);

    const organizations = session?.user?.organizations || [];
    const currentOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0] || null;
    const currentWorkspace = currentOrg?.workspaces?.find((w) => w.id === currentWorkspaceId) || currentOrg?.workspaces?.[0] || null;

    // Hydrate from localStorage
    useEffect(() => {
        if (!session?.user?.id) return;

        const savedOrgId = localStorage.getItem(`flexflow:org:${session.user.id}`);
        const savedWsId = localStorage.getItem(`flexflow:ws:${session.user.id}`);

        const orgs = session.user.organizations || [];
        const orgExists = orgs.find((o) => o.id === savedOrgId);
        const targetOrg = orgExists || orgs[0];

        if (targetOrg) {
            setCurrentOrgId(targetOrg.id);
            const wsExists = targetOrg.workspaces?.find((w) => w.id === savedWsId);
            const targetWs = wsExists || targetOrg.workspaces?.[0];
            if (targetWs) setCurrentWorkspaceId(targetWs.id);
        }

        setIsReady(true);
    }, [session?.user?.id]);

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
        if (!session?.user?.accessToken) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${session.user.accessToken}` },
            });
            if (!res.ok) return;
            const json = await res.json();
            if (json.success) {
                await updateSession({ organizations: json.data.organizations, onboarded: json.data.user.onboarded });
            }
        } catch {}
    }, [session?.user?.accessToken, updateSession]);

    return (
        <AppContext.Provider value={{
            organizations,
            currentOrg,
            currentWorkspace,
            currentOrgId: currentOrg?.id || null,
            currentWorkspaceId: currentWorkspace?.id || null,
            accessToken: session?.user?.accessToken || null,
            user: session?.user || null,
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
