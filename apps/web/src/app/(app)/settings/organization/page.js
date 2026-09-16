"use client";

import { useRef, useState, useEffect } from "react";
import { AlertTriangle, Building2, Check, ChevronRight, Copy, ImagePlus, Loader2, Sparkles, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { apiRequest } from "@/lib/api-client";
import { imageFileToLogoDataUrl } from "@/lib/image-upload";
import {
  fetchOrganization,
  updateOrganization,
  deleteOrganization,
  fetchOrgMembers,
  updateMemberRole,
  updateMemberTag,
  removeMember,
  inviteToOrg,
  cancelOrgInvite,
} from "@/lib/org-api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Image from "next/image";
import { useI18n } from "@/i18n";

const ROLE_COLORS = {
  OWNER: "bg-brand-50 text-brand-700",
  ADMIN: "bg-violet-50 text-violet-700",
  MEMBER: "bg-slate-50 text-slate-700",
  VIEWER: "bg-zinc-50 text-zinc-600",
};

function roleLabel(role, t) {
  const labels = {
    OWNER: t("settings.organization.roleOwner"),
    ADMIN: t("settings.organization.roleAdmin"),
    MEMBER: t("settings.organization.roleMember"),
    VIEWER: t("settings.organization.roleViewer"),
  };
  const key = String(role || "").toUpperCase();
  return labels[key] || (role?.charAt(0) + role?.slice(1).toLowerCase());
}

function fmtCount(value, t, locale) {
  if (!Number.isFinite(value)) return t("settings.common.unlimited");
  return value.toLocaleString(locale);
}

function UsageBar({ label, used, limit, unit, t, locale }) {
  const pct = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-(--text-secondary)">{label}</span>
        <span className="text-(--text-muted)">
          {fmtCount(used, t, locale)} {unit}{Number.isFinite(limit) ? ` / ${fmtCount(limit, t, locale)}` : ""}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-(--bg-overlay)">
        <div
          className={[
            "h-full rounded-full transition-all",
            pct >= 100 ? "bg-danger-500" : pct >= 80 ? "bg-warning-500" : "bg-brand-500",
          ].join(" ")}
          style={{ width: `${Number.isFinite(limit) ? pct : 4}%` }}
        />
      </div>
    </div>
  );
}

function MemberTag({ member, canEdit, onSave }) {
  const { t } = useI18n();
  const [value, setValue] = useState(member.tag || "");
  const [saving, setSaving] = useState(false);

  async function commit() {
    const tag = value.trim();
    if (tag === (member.tag || "")) return;
    setSaving(true);
    try {
      await onSave(member, tag);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    if (!member.tag) return null;
    return (
      <span className="shrink-0 rounded-full bg-(--bg-overlay) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">
        {member.tag}
      </span>
    );
  }

  return (
    <input
      value={value}
      disabled={saving}
      maxLength={40}
      placeholder={t("settings.organization.memberTagPlaceholder")}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="w-32 shrink-0 rounded-md border border-(--border) bg-(--bg) px-2 py-0.5 text-xs text-(--text-secondary) placeholder-(--text-muted) focus:border-brand-500 focus:outline-none"
    />
  );
}

export default function OrganizationSettingsPage() {
  const { currentOrg, accessToken, isReady, refreshOrganizations } = useApp();
  const { addToast } = useToast();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const logoInputRef = useRef(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [error, setError] = useState("");
  const [billingData, setBillingData] = useState(null);
  const { planName, limits, can } = useEntitlements();
  const canManageMembers = ["OWNER", "ADMIN"].includes(currentOrg?.role);
  const inviteRoleOptions = currentOrg?.role === "OWNER" ? ["ADMIN", "MEMBER", "VIEWER"] : ["MEMBER", "VIEWER"];

  function canEditMember(memberRole) {
    if (!canManageMembers || memberRole === "OWNER") return false;
    if (currentOrg?.role === "OWNER") return true;
    return memberRole !== "ADMIN";
  }

  function roleOptionsFor(memberRole) {
    if (currentOrg?.role === "OWNER") return ["ADMIN", "MEMBER", "VIEWER"];
    if (memberRole === "ADMIN") return ["ADMIN"];
    return ["MEMBER", "VIEWER"];
  }

  useEffect(() => {
    if (!isReady || !currentOrg?.id || !accessToken) return;
    Promise.all([
      fetchOrganization(currentOrg.id, accessToken),
      fetchOrgMembers(currentOrg.id, accessToken),
      apiRequest(`/billing/current/${currentOrg.id}`, { token: accessToken, toast: false }).catch(() => null),
    ])
      .then(([orgData, memberData, billing]) => {
        setOrg(orgData);
        setName(orgData.name || "");
        setDescription(orgData.description || "");
        setLogoUrl(orgData.logoUrl || "");
        setMembers(memberData.members || []);
        setInvites(memberData.invites || []);
        setBillingData(billing || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentOrg?.id, accessToken, isReady]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateOrganization(currentOrg.id, { name, description, logoUrl }, accessToken);
      setOrg(updated);
      await refreshOrganizations();
      addToast(t("settings.organization.organizationUpdated"), "success");
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId, role) {
    try {
      await updateMemberRole(currentOrg.id, userId, role, accessToken);
      setMembers((prev) => prev.map((m) => (m.user?.id === userId ? { ...m, role } : m)));
      addToast(t("settings.organization.memberRoleUpdated"), "success");
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    }
  }

  async function handleTagSave(member, tag) {
    try {
      await updateMemberTag(currentOrg.id, member.user?.id, tag, accessToken);
      setMembers((prev) => prev.map((m) => (m.user?.id === member.user?.id ? { ...m, tag: tag || null } : m)));
      addToast(
        tag ? t("settings.organization.memberTagUpdated") : t("settings.organization.memberTagRemoved"),
        "success"
      );
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    }
  }

  async function handleRemoveMember(userId) {
    if (!confirm(t("settings.organization.removeMemberConfirm"))) return;
    try {
      await removeMember(currentOrg.id, userId, accessToken);
      setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
      addToast(t("settings.organization.memberRemoved"), "success");
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.includes("@")) return;
    setInviting(true);
    try {
      const invite = await inviteToOrg(currentOrg.id, inviteEmail, inviteRole, accessToken);
      setInvites((prev) => [
        invite,
        ...prev.filter((inv) => inv.id !== invite.id && inv.email?.toLowerCase() !== invite.email?.toLowerCase()),
      ]);
      setInviteEmail("");
      if (invite.emailSent) {
        addToast(invite.resent ? t("settings.organization.inviteResent") : t("settings.organization.inviteSent"), "success");
      } else {
        const missing = invite.emailConfig?.missing?.length ? ` ${t("settings.organization.inviteMissing", { names: invite.emailConfig.missing.join(", ") })}.` : "";
        addToast(`${t("settings.organization.inviteLinkNoEmail")}${missing}`, "info");
      }
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLogoUrl(await imageFileToLogoDataUrl(file));
      addToast(t("settings.common.logoReady"), "success");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handleCancelInvite(inviteId) {
    try {
      await cancelOrgInvite(currentOrg.id, inviteId, accessToken);
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
      addToast(t("settings.organization.invitationCancelled"), "success");
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    }
  }

  async function handleDeleteOrganization() {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    setError("");
    try {
      await deleteOrganization(currentOrg.id, accessToken);
      addToast(t("settings.organization.organizationDeleted"), "success");
      await refreshOrganizations();
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  function copyInviteCode() {
    if (!org?.inviteCode) return;
    navigator.clipboard.writeText(org.inviteCode);
    setCodeCopied(true);
    addToast(t("settings.organization.inviteCodeCopied"), "success");
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
        <h1 className="text-xl font-semibold text-(--text-primary)">{t("settings.organization.title")}</h1>
        <p className="mt-0.5 text-sm text-(--text-muted)">
          {t("settings.organization.subtitle", { name: org?.name || t("settings.organization.yourOrganization") })}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Plan, usage & limits */}
      <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-(--text-primary)">{t("settings.organization.planUsageLimits")}</h2>
              <p className="mt-0.5 text-xs text-(--text-muted)">
                {t("settings.organization.planEnforced", { plan: planName })}
              </p>
            </div>
          </div>
          <a
            href={`/settings/billing?orgId=${currentOrg?.id}`}
            className="flex items-center gap-1 rounded-lg border border-(--border) px-3 py-2 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
          >
            {t("settings.organization.billingAndPlans")} <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-5 space-y-4">
          <UsageBar
            label={t("settings.common.members")}
            used={members.length}
            limit={limits?.members}
            unit=""
            t={t}
            locale={locale}
          />
          <UsageBar
            label={t("settings.common.apiRequestsMonth")}
            used={billingData?.usage?.apiUsage?.requestCount || 0}
            limit={limits?.apiRequestsPerMonth}
            unit="req"
            t={t}
            locale={locale}
          />
          <UsageBar
            label={t("settings.common.intelligenceQueriesToday")}
            used={billingData?.usage?.intelligenceUsage?.queryCount || 0}
            limit={limits?.teamIntelligenceQueriesPerDay}
            unit="query"
            t={t}
            locale={locale}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-(--border) pt-4 text-xs text-(--text-muted)">
          <span className="rounded-full bg-(--bg-overlay) px-2.5 py-1 text-(--text-secondary)">
            {limits?.organizations === 1
              ? t("settings.organization.countOrganizationOne", { count: fmtCount(limits?.organizations, t, locale) })
              : t("settings.organization.countOrganizationMany", { count: fmtCount(limits?.organizations, t, locale) })}
          </span>
          <span className="rounded-full bg-(--bg-overlay) px-2.5 py-1 text-(--text-secondary)">
            {t("settings.organization.countWorkspaces", { count: fmtCount(limits?.workspaces, t, locale) })}
          </span>
          <span className="rounded-full bg-(--bg-overlay) px-2.5 py-1 text-(--text-secondary)">
            {limits?.members === 1
              ? t("settings.organization.countMemberOne", { count: fmtCount(limits?.members, t, locale) })
              : t("settings.organization.countMemberMany", { count: fmtCount(limits?.members, t, locale) })}
          </span>
        </div>
      </section>

      {/* Profile */}
      <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Building2 className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-(--text-primary)">{t("settings.organization.profileTitle")}</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">{t("settings.organization.nameLabel")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("settings.organization.namePlaceholder")} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">{t("settings.organization.logoLabel")}</label>
            <div className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--bg) p-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-600 text-sm font-bold text-white">
                {logoUrl ? (
                  <Image src={logoUrl} alt={`${name || t("settings.organization.organization")} ${t("settings.organization.logoWord")}`} fill className="object-cover" />
                ) : (
                  (name || "OR").slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-(--text-primary)">{t("settings.organization.logoHint")}</p>
                <p className="text-xs text-(--text-muted)">{t("settings.organization.logoSidebarHint")}</p>
              </div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
              <Button type="button" variant="secondary" onClick={() => logoInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                {t("settings.common.upload")}
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              {t("settings.organization.descriptionLabel")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("settings.organization.descriptionPlaceholder")}
              className="w-full resize-none rounded-lg border border-(--border) bg-(--bg) px-3 py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--text-secondary)">
              {t("settings.organization.inviteCodeLabel")}
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
                {codeCopied ? t("settings.common.copied") : t("settings.common.copy")}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-(--text-muted)">
              {t("settings.organization.inviteCodeHint")}
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("settings.common.saveChanges")}
            </Button>
          </div>
        </form>
      </section>

      {/* Members */}
      <section className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
        <div className="border-b border-(--border) px-5 py-4">
          <h2 className="text-sm font-semibold text-(--text-primary)">{t("settings.organization.membersTitle")}</h2>
          <p className="mt-0.5 text-xs text-(--text-muted)">
            {members.length === 1
              ? t("settings.organization.countMemberOne", { count: members.length })
              : t("settings.organization.countMemberMany", { count: members.length })}
          </p>
        </div>

        {/* Invite row */}
        {canManageMembers && (
        <form
          onSubmit={handleInvite}
          className="flex items-center gap-2 border-b border-(--border) bg-(--bg-sunken) px-5 py-3"
        >
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={t("settings.organization.invitePlaceholder")}
            className="flex-1"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="h-10 rounded-lg border border-(--border) bg-(--bg) px-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none"
          >
            {inviteRoleOptions.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r, t)}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={inviting} size="sm">
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {t("settings.common.invite")}
          </Button>
        </form>
        )}

        <div className="divide-y divide-(--border)">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-violet-500 text-xs font-semibold text-white">
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
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-xs text-(--text-muted)">{m.user?.email}</p>
                  <MemberTag
                    key={`${m.id}:${m.tag || ""}`}
                    member={m}
                    canEdit={canManageMembers && canEditMember(m.role)}
                    onSave={handleTagSave}
                  />
                </div>
              </div>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  ROLE_COLORS[m.role] || ROLE_COLORS.MEMBER,
                ].join(" ")}
              >
                {roleLabel(m.role, t)}
              </span>
              {canManageMembers && (
                <div className="flex items-center gap-1">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.user?.id, e.target.value)}
                    disabled={!canEditMember(m.role)}
                    className="h-7 rounded-md border border-(--border) bg-(--bg) px-2 text-xs text-(--text-secondary) focus:outline-none"
                  >
                    {roleOptionsFor(m.role).map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r, t)}
                      </option>
                    ))}
                  </select>
                  {canEditMember(m.role) && (
                    <button
                      aria-label={t("settings.organization.removeMemberAria", { name: m.user?.name ?? t("settings.organization.member") })}
                      onClick={() => handleRemoveMember(m.user?.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
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
            <h2 className="text-sm font-semibold text-(--text-primary)">{t("settings.organization.pendingInvitations")}</h2>
          </div>
          <div className="divide-y divide-(--border)">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <p className="flex-1 text-sm text-(--text-primary)">{inv.email}</p>
                <span className="text-xs text-(--text-muted)">
                  {roleLabel(inv.role, t)}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {t("settings.common.pending")}
                </span>
                <button
                  type="button"
                  onClick={() => handleCancelInvite(inv.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-red-50 hover:text-red-500"
                  title={t("settings.organization.cancelInvitationTitle")}
                  aria-label={t("settings.organization.cancelInvitationAria", { email: inv.email })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger zone — Owner only */}
      {currentOrg?.role === "OWNER" && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-red-700">{t("settings.organization.dangerZone")}</h2>
          </div>
          <p className="mb-4 text-sm text-red-600">
            {t("settings.organization.dangerZoneDescription")}
          </p>
          <div className="flex items-center gap-3">
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={t("settings.organization.deleteConfirmPlaceholder")}
              className="max-w-xs"
            />
            <button
              onClick={handleDeleteOrganization}
              disabled={deleteConfirm !== "DELETE" || deleting}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? t("settings.common.deleting") : t("settings.organization.deleteOrganization")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
