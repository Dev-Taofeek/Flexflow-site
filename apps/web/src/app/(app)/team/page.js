"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { fetchTeamData, inviteMember, updateMemberRole, removeMember } from "@/lib/team-api";
import { TeamClient } from "@/components/team/TeamClient";

export default function TeamPage() {
  const { currentWorkspace, accessToken, isReady } = useApp();
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
    setTeamData((prev) => ({ ...prev, invites: [invite, ...(prev.invites || [])] }));
    return invite;
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
  }

  async function handleRemove(memberId) {
    await removeMember({ memberId, workspaceId: currentWorkspace.id, token: accessToken });
    setTeamData((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.memberId !== memberId),
    }));
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
        roles={teamData?.roles || ["OWNER", "ADMIN", "MEMBER", "VIEWER"]}
        currentUserRole={teamData?.currentUserRole}
        onInvite={handleInvite}
        onRoleChange={handleRoleChange}
        onRemove={handleRemove}
      />
    </div>
  );
}
