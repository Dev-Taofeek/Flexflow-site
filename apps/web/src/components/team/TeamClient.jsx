"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Send, Trash2, UserMinus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";
import Image from "next/image";

const ROLE_COLORS = {
  OWNER: "bg-brand-50 text-brand-700 border-brand-200",
  ADMIN: "bg-violet-50 text-violet-700 border-violet-200",
  MEMBER: "bg-slate-50 text-slate-700 border-slate-200",
  VIEWER: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

export function TeamClient({
  initialMembers = [],
  initialInvitations = [],
  availableMembers = [],
  roles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  currentUserRole,
  onInvite,
  onAddExisting,
  onRoleChange,
  onRemove,
  onCancelInvite,
}) {
  const { addToast } = useToast();
  const { t } = useI18n();
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [orgMembers, setOrgMembers] = useState(availableMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState(null); // { emailSent, inviteUrl }
  const [addingId, setAddingId] = useState(null);
  const [addRoles, setAddRoles] = useState({});

  const canManage = currentUserRole && ["OWNER", "ADMIN"].includes(currentUserRole);
  const editableInviteRoles = currentUserRole === "OWNER" ? ["ADMIN", "MEMBER", "VIEWER"] : ["MEMBER", "VIEWER"];

  function canEditMember(member) {
    if (!canManage || member.role === "OWNER") return false;
    if (currentUserRole === "OWNER") return true;
    return member.role !== "ADMIN";
  }

  function editableRolesFor(member) {
    if (currentUserRole === "OWNER") return ["ADMIN", "MEMBER", "VIEWER"];
    if (member.role === "ADMIN") return ["ADMIN"];
    return ["MEMBER", "VIEWER"];
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setInviteError(t("team.invalidEmail"));
      return;
    }
    setInviteError("");
    setInviteResult(null);
    setIsInviting(true);
    try {
      const invite = await onInvite?.({ email, role });
      if (invite) {
        setInvitations((prev) => [
          invite,
          ...prev.filter((inv) => inv.id !== invite.id && inv.email?.toLowerCase() !== invite.email?.toLowerCase()),
        ]);
        setInviteResult({ emailSent: invite.emailSent, inviteUrl: invite.inviteUrl, emailConfig: invite.emailConfig });
      }
      setEmail("");
      setRole("MEMBER");
    } catch (err) {
      setInviteError(err.message);
      addToast(err.message, "error");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(memberId, nextRole) {
    setMembers((prev) => prev.map((m) => (m.memberId === memberId ? { ...m, role: nextRole } : m)));
    try {
      await onRoleChange?.({ memberId, role: nextRole });
    } catch (err) {
      addToast(err.message || t("team.roleUpdateFailed"), "error");
    }
  }

  async function handleRemove(memberId) {
    if (!confirm(t("team.confirmRemove"))) return;
    try {
      await onRemove?.(memberId);
      setMembers((prev) => prev.filter((m) => m.memberId !== memberId));
    } catch (err) {
      addToast(err.message || t("team.removeFailed"), "error");
    }
  }

  async function handleAddExisting(userId) {
    setAddingId(userId);
    try {
      await onAddExisting?.({ userId, role: addRoles[userId] || "MEMBER" });
      setOrgMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      addToast(err.message || t("team.addFailed"), "error");
    } finally {
      setAddingId(null);
    }
  }

  async function handleCancelInvite(inviteId, inviteEmail) {
    try {
      await onCancelInvite?.(inviteId);
      setInvitations((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch (err) {
      addToast(err.message || t("team.cancelInviteFailed", { email: inviteEmail }), "error");
    }
  }

  function getInitials(name) {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?"
    );
  }

  function roleLabel(r) {
    return t(`team.role.${String(r).toLowerCase()}`);
  }

  return (
    <div className="space-y-5">
      {/* Invite */}
      {canManage && (
        <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-(--text-primary)">{t("team.inviteTeammate")}</h2>
              <p className="text-xs text-(--text-muted)">
                {t("team.inviteDescription")}
              </p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("team.emailPlaceholder")}
                isInvalid={Boolean(inviteError)}
              />
              {inviteError && <p className="mt-1 text-xs text-red-500">{inviteError}</p>}
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
            >
              {editableInviteRoles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
            </select>
            <Button type="submit" isLoading={isInviting}>
              {t("team.sendInvite")}
            </Button>
          </form>

          {/* Post-invite feedback */}
          {inviteResult && (
            <div className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${inviteResult.emailSent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {inviteResult.emailSent ? (
                t("team.inviteSentFeedback")
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">{t("team.inviteLinkCreated")}</p>
                  <p className="text-xs">
                    {t("team.emailJsNotConfigured", { missing: inviteResult.emailConfig?.missing?.length ? ` (${inviteResult.emailConfig.missing.join(", ")} missing)` : "" })}{" "}
                    {t("team.shareInviteLink")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      readOnly
                      value={inviteResult.inviteUrl}
                      className="flex-1 rounded border border-amber-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(inviteResult.inviteUrl)}
                      className="rounded px-2 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 transition-colors"
                    >
                      {t("team.copy")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Add from other workspaces */}
      {canManage && orgMembers.length > 0 && (
        <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-(--text-primary)">{t("team.addFromOrg")}</h2>
              <p className="text-xs text-(--text-muted)">
                {t("team.addFromOrgDescription")}
              </p>
            </div>
          </div>

          <div className="divide-y divide-(--border)">
            {orgMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-violet-500 text-xs font-semibold text-white">
                  {getInitials(member.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--text-primary)">{member.name}</p>
                  <p className="truncate text-xs text-(--text-muted)">{member.email}</p>
                </div>
                <select
                  value={addRoles[member.id] || "MEMBER"}
                  onChange={(e) => setAddRoles((prev) => ({ ...prev, [member.id]: e.target.value }))}
                  className="h-8 rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--text-secondary) focus:border-brand-500 focus:outline-none"
                >
                  {(currentUserRole === "OWNER" ? ["ADMIN", "MEMBER", "VIEWER"] : ["MEMBER", "VIEWER"]).map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  isLoading={addingId === member.id}
                  onClick={() => handleAddExisting(member.id)}
                >
                  {t("team.add")}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members table */}
      <section className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
        <div className="flex items-center justify-between border-b border-(--border) px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-(--text-primary)">{t("team.members")}</h2>
            <p className="mt-0.5 text-xs text-(--text-muted)">
              {t(members.length === 1 ? "team.memberListCountOne" : "team.memberListCountMany", { count: members.length })}
            </p>
          </div>
        </div>

        <div className="divide-y divide-(--border)">
          {members.map((member) => (
            <div key={member.memberId || member.id} className="flex items-center gap-3 px-5 py-3.5">
              <Link href={`/profile/${member.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-violet-500 text-xs font-semibold text-white">
                  {member.avatarUrl ? (
                    <Image
                      src={member.avatarUrl}
                      alt={member.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(member.name)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--text-primary)">{member.name}</p>
                  <p className="truncate text-xs text-(--text-muted)">{member.email}</p>
                </div>
              </Link>

              <span
                className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  ROLE_COLORS[member.role] || ROLE_COLORS.MEMBER,
                ].join(" ")}
              >
                {roleLabel(member.role)}
              </span>

              {canManage && (
                <div className="flex items-center gap-1">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.memberId || member.id, e.target.value)}
                    disabled={!canEditMember(member)}
                    className="h-7 rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--text-secondary) focus:border-brand-500 focus:outline-none"
                  >
                    {editableRolesFor(member).map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  {canEditMember(member) && (
                    <button
                      onClick={() => handleRemove(member.memberId || member.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-red-50 hover:text-red-500"
                      title={t("team.removeMember")}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {members.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-(--text-muted)">{t("team.noMembers")}</p>
            </div>
          )}
        </div>
      </section>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
          <div className="flex items-center gap-3 border-b border-(--border) px-5 py-4">
            <Mail className="h-4 w-4 text-(--text-muted)" />
            <h2 className="text-sm font-semibold text-(--text-primary)">{t("team.pendingInvitations")}</h2>
            <span className="ml-auto text-xs text-(--text-muted)">{invitations.length}</span>
          </div>

          <div className="divide-y divide-(--border)">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-(--text-primary)">{inv.email}</p>
                  <p className="text-xs text-(--text-muted)">
                    {t("team.invitedAs", { role: roleLabel(inv.role) })}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {t("team.pending")}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleCancelInvite(inv.id, inv.email)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-red-50 hover:text-red-500"
                    title={t("team.cancelInvitation")}
                    aria-label={t("team.cancelInvitationFor", { email: inv.email })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
