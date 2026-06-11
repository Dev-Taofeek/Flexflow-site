"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { fetchTeamData, inviteMember, addExistingMember, updateMemberRole, removeMember, cancelInvite } from "@/lib/team-api";
import { TeamClient } from "@/components/team/TeamClient";

export default function TeamPage() {
  const { currentWorkspace, accessToken, isReady } = useApp();
  const { addToast } = useToast();
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isReady || !currentWorkspace?.id || !accessToken) return;
    load();
  }, [currentWorkspace?.id, accessToken, isReady]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamData(currentWorkspace.id, accessToken);
      setTeamData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
      addToast(invite.resent ? "Invite email resent." : "Invitation email sent.", "success");
    } else {
      const missing = invite.emailConfig?.missing?.length ? ` Missing: ${invite.emailConfig.missing.join(", ")}.` : "";
      addToast(`Invite link created, but EmailJS is not configured so no email was sent.${missing}`, "info");
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
    addToast(`${member.name} added to ${currentWorkspace.name}.`, "success");
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
    addToast("Member role updated.", "success");
  }

  async function handleRemove(memberId) {
    await removeMember({ memberId, workspaceId: currentWorkspace.id, token: accessToken });
    setTeamData((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.memberId !== memberId),
    }));
    addToast("Member removed.", "success");
  }

  async function handleCancelInvite(inviteId) {
    await cancelInvite({ inviteId, workspaceId: currentWorkspace.id, token: accessToken });
    setTeamData((prev) => ({
      ...prev,
      invites: prev.invites.filter((inv) => inv.id !== inviteId),
    }));
    addToast("Invitation cancelled.", "success");
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
        <h1 className="text-xl font-semibold text-(--text-primary)">Team</h1>
        <p className="mt-0.5 text-sm text-(--text-muted)">
          {teamData?.members?.length || 0} member{teamData?.members?.length !== 1 ? "s" : ""} in{" "}
          {currentWorkspace?.name}
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
