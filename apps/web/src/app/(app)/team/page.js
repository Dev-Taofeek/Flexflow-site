"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { fetchTeamData, inviteMember, addExistingMember, updateMemberRole, removeMember, cancelInvite } from "@/lib/team-api";
import { useI18n } from "@/i18n";
import { TeamClient } from "@/components/team/TeamClient";

export default function TeamPage() {
  const { currentWorkspace, accessToken, isReady } = useApp();
  const { addToast } = useToast();
  const { t } = useI18n();
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const workspaceId = currentWorkspace?.id;

  const load = useCallback(async () => {
    if (!workspaceId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamData(workspaceId, accessToken);
      setTeamData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, accessToken]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => { await load(); })();
    return () => { cancelled = true; };
  }, [isReady, load]);

  async function handleInvite({ email, role }) {
    const invite = await inviteMember({
      workspaceId: currentWorkspace.id,
      email,
      role,
      token: accessToken,
    });
    setTeamData((prev) => ({
      ...prev,
      invites: [invite, ...(prev.invites || []).filter((i) => i.id !== invite.id && i.email?.toLowerCase() !== invite.email?.toLowerCase())],
    }));
    if (invite.emailSent) {
      addToast(invite.resent ? t("team.inviteResent") : t("team.inviteSent"), "success");
    } else {
      const missing = invite.emailConfig?.missing?.length ? ` Missing: ${invite.emailConfig.missing.join(", ")}.` : "";
      addToast(`${t("team.inviteLinkNoEmail")}${missing}`, "info");
    }
    return invite;
  }

  async function handleAddExisting({ userId, role }) {
    const result = await addExistingMember({
      workspaceId: currentWorkspace.id,
      userId,
      role,
      token: accessToken,
    });
    const member = { ...result.user, role: result.role, memberId: result.id, joinedAt: result.createdAt };
    setTeamData((prev) => ({
      ...prev,
      members: [...(prev.members || []), member],
      availableMembers: (prev.availableMembers || []).filter((m) => m.id !== userId),
    }));
    addToast(t("team.memberAdded", { name: member.name, workspace: currentWorkspace.name }), "success");
  }

  async function handleRoleChange({ memberId, role }) {
    const updated = await updateMemberRole({
      memberId,
      workspaceId: currentWorkspace.id,
      role,
      token: accessToken,
    });
    setTeamData((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.memberId === memberId ? { ...m, ...updated } : m)),
    }));
    addToast(t("team.roleUpdated"), "success");
  }

  async function handleRemove(memberId) {
    await removeMember({ memberId, workspaceId: currentWorkspace.id, token: accessToken });
    setTeamData((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.memberId !== memberId),
    }));
    addToast(t("team.memberRemoved"), "success");
  }

  async function handleCancelInvite(inviteId) {
    await cancelInvite({ inviteId, workspaceId: currentWorkspace.id, token: accessToken });
    setTeamData((prev) => ({
      ...prev,
      invites: prev.invites.filter((inv) => inv.id !== inviteId),
    }));
    addToast(t("team.inviteCancelled"), "success");
  }

  if (loading || !isReady) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-(--border)" />
        <div className="h-64 animate-pulse rounded-xl bg-(--border)" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
        <p className="text-sm text-(--text-muted)">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-(--text-primary)">{t("team.title")}</h1>
        <p className="mt-0.5 text-sm text-(--text-muted)">
          {t(teamData?.members?.length === 1 ? "team.memberInWorkspaceOne" : "team.memberInWorkspaceMany", { count: teamData?.members?.length || 0, name: currentWorkspace?.name })}
        </p>
      </div>

      <TeamClient
        initialMembers={teamData?.members || []}
        initialInvitations={teamData?.invites || []}
        availableMembers={teamData?.availableMembers || []}
        roles={teamData?.roles || ["OWNER", "ADMIN", "MEMBER", "VIEWER"]}
        currentUserRole={teamData?.currentUserRole}
        onInvite={handleInvite}
        onAddExisting={handleAddExisting}
        onRoleChange={handleRoleChange}
        onRemove={handleRemove}
        onCancelInvite={handleCancelInvite}
      />
    </div>
  );
}
