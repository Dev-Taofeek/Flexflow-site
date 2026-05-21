"use client";

import { useState } from "react";
import { Mail, MoreHorizontal, Send, ShieldCheck, Trash2, UserMinus } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Image from "next/image";

const ROLE_COLORS = {
  OWNER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ADMIN: "bg-violet-50 text-violet-700 border-violet-200",
  MEMBER: "bg-slate-50 text-slate-700 border-slate-200",
  VIEWER: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

export function TeamClient({
  initialMembers = [],
  initialInvitations = [],
  roles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  currentUserRole,
  onInvite,
  onRoleChange,
  onRemove,
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState(null); // { emailSent, inviteUrl }

  const canManage = currentUserRole && ["OWNER", "ADMIN"].includes(currentUserRole);

  async function handleInvite(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setInviteError("Enter a valid email");
      return;
    }
    setInviteError("");
    setInviteResult(null);
    setIsInviting(true);
    try {
      const invite = await onInvite?.({ email, role });
      if (invite) {
        setInvitations((prev) => [invite, ...prev]);
        setInviteResult({ emailSent: invite.emailSent, inviteUrl: invite.inviteUrl });
      }
      setEmail("");
      setRole("MEMBER");
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(memberId, nextRole) {
    setMembers((prev) => prev.map((m) => (m.memberId === memberId ? { ...m, role: nextRole } : m)));
    try {
      await onRoleChange?.({ memberId, role: nextRole });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemove(memberId) {
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      await onRemove?.(memberId);
      setMembers((prev) => prev.filter((m) => m.memberId !== memberId));
    } catch (err) {
      console.error(err);
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

  return (
    <div className="space-y-5">
      {/* Invite */}
      {canManage && (
        <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-(--text-primary)">Invite teammate</h2>
              <p className="text-xs text-(--text-muted)">
                Send an email invite and assign a starting role.
              </p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                isInvalid={Boolean(inviteError)}
              />
              {inviteError && <p className="mt-1 text-xs text-red-500">{inviteError}</p>}
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 rounded-lg border border-(--border) bg-(--bg) px-3 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
            >
              {roles
                .filter((r) => r !== "OWNER")
                .map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </option>
                ))}
            </select>
            <Button type="submit" isLoading={isInviting}>
              Send invite
            </Button>
          </form>

          {/* Post-invite feedback */}
          {inviteResult && (
            <div className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${inviteResult.emailSent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {inviteResult.emailSent ? (
                "Invite email sent successfully."
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">Email not sent — RESEND_API_KEY not configured on the server.</p>
                  <p className="text-xs">Share this invite link manually:</p>
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
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Members table */}
      <section className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
        <div className="flex items-center justify-between border-b border-(--border) px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-(--text-primary)">Members</h2>
            <p className="mt-0.5 text-xs text-(--text-muted)">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="divide-y divide-(--border)">
          {members.map((member) => (
            <div key={member.memberId || member.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
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

              <span
                className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  ROLE_COLORS[member.role] || ROLE_COLORS.MEMBER,
                ].join(" ")}
              >
                {member.role?.charAt(0) + member.role?.slice(1).toLowerCase()}
              </span>

              {canManage && (
                <div className="flex items-center gap-1">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.memberId || member.id, e.target.value)}
                    className="h-7 rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--text-secondary) focus:border-indigo-500 focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemove(member.memberId || member.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Remove member"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {members.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-(--text-muted)">No members found.</p>
            </div>
          )}
        </div>
      </section>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
          <div className="flex items-center gap-3 border-b border-(--border) px-5 py-4">
            <Mail className="h-4 w-4 text-(--text-muted)" />
            <h2 className="text-sm font-semibold text-(--text-primary)">Pending invitations</h2>
            <span className="ml-auto text-xs text-(--text-muted)">{invitations.length}</span>
          </div>

          <div className="divide-y divide-(--border)">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-(--text-primary)">{inv.email}</p>
                  <p className="text-xs text-(--text-muted)">
                    Invited as {inv.role?.charAt(0) + inv.role?.slice(1).toLowerCase()}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
