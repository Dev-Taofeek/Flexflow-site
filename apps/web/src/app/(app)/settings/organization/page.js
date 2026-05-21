"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Building2, Check, Copy, Loader2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import {
  fetchOrganization,
  updateOrganization,
  fetchOrgMembers,
  updateMemberRole,
  removeMember,
  inviteToOrg,
} from "@/lib/org-api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

const ROLE_COLORS = {
  OWNER: "bg-indigo-50 text-indigo-700",
  ADMIN: "bg-violet-50 text-violet-700",
  MEMBER: "bg-slate-50 text-slate-700",
  VIEWER: "bg-zinc-50 text-zinc-600",
};

export default function OrganizationSettingsPage() {
  const { currentOrg, accessToken, isReady, refreshOrganizations } = useApp();
  const router = useRouter();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isReady || !currentOrg?.id || !accessToken) return;
    Promise.all([
      fetchOrganization(currentOrg.id, accessToken),
      fetchOrgMembers(currentOrg.id, accessToken),
    ])
      .then(([orgData, memberData]) => {
        setOrg(orgData);
        setName(orgData.name || "");
        setDescription(orgData.description || "");
        setMembers(memberData.members || []);
        setInvites(memberData.invites || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentOrg?.id, accessToken, isReady]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateOrganization(currentOrg.id, { name, description }, accessToken);
      setOrg(updated);
      await refreshOrganizations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId, role) {
    try {
      await updateMemberRole(currentOrg.id, userId, role, accessToken);
      setMembers((prev) => prev.map((m) => (m.user?.id === userId ? { ...m, role } : m)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveMember(userId) {
    if (!confirm("Remove this member from the organization?")) return;
    try {
      await removeMember(currentOrg.id, userId, accessToken);
      setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.includes("@")) return;
    setInviting(true);
    try {
      const invite = await inviteToOrg(currentOrg.id, inviteEmail, inviteRole, accessToken);
      setInvites((prev) => [invite, ...prev]);
      setInviteEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  function copyInviteCode() {
    if (!org?.inviteCode) return;
    navigator.clipboard.writeText(org.inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  if (loading)
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-(--border)" />
        ))}
      </div>
    );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-(--text-primary)">Organization Settings</h1>
        <p className="mt-0.5 text-sm text-(--text-muted)">
          Manage {org?.name || "your organization"}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Profile */}
      <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Building2 className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-(--text-primary)">Organization profile</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does your organization work on?"
              className="w-full resize-none rounded-lg border border-(--border) bg-(--bg) px-3 py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              Invite code
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-(--border) bg-(--bg-sunken) px-3 py-2 font-mono text-sm text-(--text-secondary)">
                {org?.inviteCode}
              </code>
              <button
                type="button"
                onClick={copyInviteCode}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-(--border) px-3 text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
              >
                {codeCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {codeCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-(--text-muted)">
              Share this code so others can join this organization.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </form>
      </section>

      {/* Members */}
      <section className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
        <div className="border-b border-(--border) px-5 py-4">
          <h2 className="text-sm font-semibold text-(--text-primary)">Members</h2>
          <p className="mt-0.5 text-xs text-(--text-muted)">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Invite row */}
        <form
          onSubmit={handleInvite}
          className="flex items-center gap-2 border-b border-(--border) bg-(--bg-sunken) px-5 py-3"
        >
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@company.com"
            className="flex-1"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="h-10 rounded-lg border border-(--border) bg-(--bg) px-2 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none"
          >
            {["ADMIN", "MEMBER", "VIEWER"].map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={inviting} size="sm">
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Invite
          </Button>
        </form>

        <div className="divide-y divide-(--border)">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
                {m.user?.avatarUrl ? (
                  <Image
                    src={m.user.avatarUrl}
                    className="h-8 w-8 rounded-full object-cover"
                    alt={m.user.name}
                  />
                ) : (
                  m.user?.name?.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">{m.user?.name}</p>
                <p className="truncate text-xs text-(--text-muted)">{m.user?.email}</p>
              </div>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  ROLE_COLORS[m.role] || ROLE_COLORS.MEMBER,
                ].join(" ")}
              >
                {m.role?.charAt(0) + m.role?.slice(1).toLowerCase()}
              </span>
              {["OWNER", "ADMIN"].includes(currentOrg?.role) && (
                <div className="flex items-center gap-1">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.user?.id, e.target.value)}
                    className="h-7 rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--text-secondary) focus:outline-none"
                  >
                    {["OWNER", "ADMIN", "MEMBER", "VIEWER"].map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label={`Remove ${m.user?.name ?? "member"}`}
                    onClick={() => handleRemoveMember(m.user?.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
          <div className="border-b border-(--border) px-5 py-4">
            <h2 className="text-sm font-semibold text-(--text-primary)">Pending invitations</h2>
          </div>
          <div className="divide-y divide-(--border)">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <p className="flex-1 text-sm text-(--text-primary)">{inv.email}</p>
                <span className="text-xs text-(--text-muted)">
                  {inv.role?.charAt(0) + inv.role?.slice(1).toLowerCase()}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        </div>
        <p className="mb-4 text-sm text-red-600">
          Deleting this organization permanently removes all projects, issues, and members. This
          cannot be undone.
        </p>
        <div className="flex items-center gap-3">
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="max-w-xs"
          />
          <button
            disabled={deleteConfirm !== "DELETE"}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Delete organization
          </button>
        </div>
      </section>
    </div>
  );
}
