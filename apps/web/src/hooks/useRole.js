"use client";

import { useApp } from "@/contexts/AppContext";

const RANK = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };

export function useRole() {
    const { currentOrg, organizations } = useApp();
    const role = currentOrg?.role || "VIEWER";
    const rank = RANK[role] ?? 1;

    return {
        role,
        isOwner:       role === "OWNER",
        isAdmin:       rank >= 3,   // OWNER or ADMIN
        isMember:      rank >= 2,   // OWNER, ADMIN, or MEMBER
        isViewer:      role === "VIEWER",
        canWrite:      rank >= 2,   // create/edit issues, comments
        canManage:     rank >= 3,   // invite members, manage workspace settings
        canAdminister: rank >= 4,   // 2FA, integrations, delete org
        ownsAnyOrg:    (organizations || []).some((o) => o.role === "OWNER"),
    };
}
