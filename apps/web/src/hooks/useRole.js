"use client";

import { useApp } from "@/contexts/AppContext";

const RANK = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };

export function useRole() {
    const { currentOrg, currentWorkspace, organizations } = useApp();
    const role = currentWorkspace?.role || currentOrg?.role || "VIEWER";
    const rank = RANK[role] ?? 1;

    return {
        role,
        isOwner:       role === "OWNER",
        isAdmin:       rank >= 3,   // OWNER or ADMIN
        isMember:      rank >= 2,   // OWNER, ADMIN, or MEMBER
        isViewer:      role === "VIEWER",
        canWrite:      rank >= 2,   // create/edit comments
        canManageProjects: rank >= 3, // create/edit/delete projects (OWNER/ADMIN only)
        canManageTasks:   rank >= 3, // create/edit/delete tasks (OWNER/ADMIN only)
        canManage:     rank >= 3,   // invite members, manage workspace settings
        canAdminister: rank >= 4,   // 2FA, integrations, delete org
        canCreateWorkspace: currentOrg?.role === "OWNER", // only the org owner can create workspaces
        ownsAnyOrg:    (organizations || []).some((o) => o.role === "OWNER"),
    };
}
