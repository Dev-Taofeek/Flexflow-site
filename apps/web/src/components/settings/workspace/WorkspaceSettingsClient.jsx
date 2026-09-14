"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LayoutGrid, Plus, Tag, X } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useRole } from "@/hooks/useRole";
import { imageFileToLogoDataUrl } from "@/lib/image-upload";
import { fetchWorkspace, updateWorkspace } from "@/lib/org-api";
import { apiRequest } from "@/lib/api-client";
import Link from "next/link";
import { useI18n } from "@/i18n";

const LABEL_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#10b981", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

export function WorkspaceSettingsClient() {
  const { canManage } = useRole();
  const { currentWorkspace, accessToken, refreshOrganizations } = useApp();
  const { addToast } = useToast();
  const logoInputRef = useRef(null);
  const { t } = useI18n();

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [workspaceLogo, setWorkspaceLogo] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  const [labels, setLabels] = useState([]);
  const [labelsLoading, setLabelsLoading] = useState(true);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");
  const [savingLabel, setSavingLabel] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState(null);

  const workspaceId = currentWorkspace?.id;

  useEffect(() => {
    if (!workspaceId || !accessToken) return;
    fetchWorkspace(workspaceId, accessToken)
      .then((workspace) => {
        setWorkspaceName(workspace.name || "");
        setWorkspaceDescription(workspace.description || "");
        setWorkspaceLogo(workspace.logoUrl || "");
      })
      .catch((err) => addToast(err.message, "error"));
  }, [workspaceId, accessToken, addToast]);

  useEffect(() => {
    if (!workspaceId || !accessToken) return;
    apiRequest(`/workspaces/${workspaceId}/labels`, { token: accessToken })
      .then(setLabels)
      .catch((err) => addToast(err.message, "error"))
      .finally(() => setLabelsLoading(false));
  }, [workspaceId, accessToken, addToast]);

  async function handleWorkspaceLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setWorkspaceLogo(await imageFileToLogoDataUrl(file));
      addToast(t("settings.common.logoReady"), "success");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handleSaveWorkspace(event) {
    event.preventDefault();
    if (!workspaceId || !accessToken) return;
    setSavingWorkspace(true);
    try {
      await updateWorkspace(
        workspaceId,
        { name: workspaceName, description: workspaceDescription, logoUrl: workspaceLogo },
        accessToken,
      );
      await refreshOrganizations();
      addToast(t("settings.workspace.workspaceUpdated"), "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function handleAddLabel(event) {
    event.preventDefault();
    if (!workspaceId || !accessToken) return;
    if (!newLabelName.trim()) return;
    setSavingLabel(true);
    try {
      const label = await apiRequest(`/workspaces/${workspaceId}/labels`, {
        method: "POST",
        token: accessToken,
        body: { name: newLabelName.trim(), color: newLabelColor },
      });
      setLabels((current) => [...current, label]);
      setNewLabelName("");
      setNewLabelColor("#6366f1");
      addToast(t("settings.workspace.labelAdded"), "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSavingLabel(false);
    }
  }

  async function handleRemoveLabel(labelId) {
    if (!workspaceId || !accessToken) return;
    setDeletingLabelId(labelId);
    try {
      await apiRequest(`/workspaces/${workspaceId}/labels/${labelId}`, {
        method: "DELETE",
        token: accessToken,
      });
      setLabels((current) => current.filter((label) => label.id !== labelId));
      addToast(t("settings.workspace.labelRemoved"), "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setDeletingLabelId(null);
    }
  }

  const labelClass = "mb-1.5 block text-sm font-medium text-(--text-primary)";

  return (
    <div className="space-y-6">
      {/* ── Workspace profile ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--bg-overlay) text-brand-500">
            <LayoutGrid className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.workspace.profileTitle")}</h2>
            <p className="mt-1 text-sm text-(--text-secondary)">
              {t("settings.workspace.profileDescription")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveWorkspace} className="mt-6 space-y-4">
          <div>
            <label className={labelClass}>{t("settings.workspace.nameLabel")}</label>
            <Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} className="mt-2" />
          </div>

          <div>
            <label className={labelClass}>{t("settings.workspace.descriptionLabel")}</label>
            <textarea
              value={workspaceDescription}
              onChange={(event) => setWorkspaceDescription(event.target.value)}
              rows={2}
              className="mt-2 w-full resize-none rounded-lg border border-(--border) bg-(--bg) px-3 py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) focus:border-brand-500 focus:outline-none"
              placeholder={t("settings.workspace.descriptionPlaceholder")}
            />
          </div>

          <div>
            <p className={labelClass}>{t("settings.workspace.logoLabel")}</p>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-(--border) bg-(--bg) p-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--bg-overlay)">
                {workspaceLogo ? (
                  <Image src={workspaceLogo} alt={`${workspaceName || t("settings.workspace.workspace")} ${t("settings.workspace.logoWord")}`} fill className="object-cover" />
                ) : (
                  <LayoutGrid className="h-5 w-5 text-(--text-muted)" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-(--text-secondary)">
                  {t("settings.workspace.logoHint")}
                </p>
                <p className="mt-0.5 text-xs text-(--text-tertiary)">
                  {t("settings.workspace.logoSidebarHint")}
                </p>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleWorkspaceLogoUpload}
                className="hidden"
              />
              <Button type="button" variant="secondary" onClick={() => logoInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" strokeWidth={1.7} />
                {t("settings.common.upload")}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canManage || savingWorkspace}>
              {savingWorkspace ? t("settings.common.saving") : t("settings.workspace.saveWorkspace")}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Labels ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--bg-overlay) text-brand-500">
            <Tag className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.workspace.labelsTitle")}</h2>
            <p className="mt-1 text-sm text-(--text-secondary)">
              {t("settings.workspace.labelsDescription")}
            </p>
          </div>
        </div>

        {labelsLoading ? (
          <p className="mt-6 text-sm text-(--text-tertiary)">{t("settings.workspace.loadingLabels")}</p>
        ) : labels.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-(--border) p-6 text-center">
            <p className="text-sm font-medium text-(--text-secondary)">{t("settings.workspace.noLabelsYet")}</p>
            <p className="mt-1 text-xs text-(--text-tertiary)">
              {t("settings.workspace.noLabelsHint")}
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            {labels.map((label) => (
              <div
                key={label.id}
                className="inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--bg) px-3 py-2"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                <span className="text-sm font-medium text-(--text-primary)">{label.name}</span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveLabel(label.id)}
                    disabled={deletingLabelId === label.id}
                    className="text-(--text-tertiary) transition-colors hover:text-danger-500 disabled:opacity-50"
                    aria-label={t("settings.workspace.removeLabelAria", { name: label.name })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {canManage ? (
          <form onSubmit={handleAddLabel} className="mt-6 rounded-xl border border-(--border) bg-(--bg) p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={newLabelName}
                onChange={(event) => setNewLabelName(event.target.value)}
                placeholder={t("settings.workspace.labelNamePlaceholder")}
                className="flex-1"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewLabelColor(color)}
                    aria-label={t("settings.workspace.colorAria", { color })}
                    className={[
                      "h-6 w-6 rounded-full transition-transform",
                      newLabelColor === color ? "scale-110 ring-2 ring-brand-500 ring-offset-2 ring-offset-(--bg)" : "hover:scale-110",
                    ].join(" ")}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Button type="submit" disabled={savingLabel || !newLabelName.trim()}>
                <Plus className="h-4 w-4" />
                {savingLabel ? t("settings.common.adding") : t("settings.workspace.addLabel")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-(--text-tertiary)">
              {t("settings.workspace.labelsFootnote")}
            </p>
          </form>
        ) : (
          <p className="mt-4 text-xs text-(--text-tertiary)">
            {t("settings.workspace.labelsNoAccess")}
          </p>
        )}
      </section>

      {/* ── Integrations ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-(--border) bg-(--bg-elevated) p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--bg-overlay) text-brand-500">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="14.5" y="2" width="4" height="8" rx="2" />
              <path d="M18.5 6H3" />
              <rect x="2" y="14.5" width="8" height="4" rx="2" />
              <path d="M6 18.5V3" />
              <rect x="14.5" y="14.5" width="4" height="4" rx="2" />
              <rect x="2" y="2" width="4" height="4" rx="2" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.workspace.integrationsTitle")}</h2>
            <p className="mt-1 text-sm text-(--text-secondary)">
              {t("settings.workspace.integrationsDescription")}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-(--border) bg-(--bg) p-5">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 shrink-0 text-brand-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="14.5" y="2" width="4" height="8" rx="2" />
              <path d="M18.5 6H3" />
              <rect x="2" y="14.5" width="8" height="4" rx="2" />
              <path d="M6 18.5V3" />
              <rect x="14.5" y="14.5" width="4" height="4" rx="2" />
              <rect x="2" y="2" width="4" height="4" rx="2" />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-(--text-primary)">{t("settings.workspace.slackWebhooks")}</p>
                <span className="rounded-full border border-(--border) px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--text-tertiary)">
                  {t("settings.common.planned")}
                </span>
              </div>
              <p className="mt-1 text-xs text-(--text-tertiary)">
                {t("settings.workspace.slackWebhooksDescription")}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-(--text-tertiary)">
          {t("settings.workspace.roadmapLine1")}{" "}
          <Link href="/roadmap" className="font-medium text-brand-500 hover:text-brand-400">
            {t("settings.workspace.roadmap")}
          </Link>{". "}
          {t("settings.workspace.roadmapLine2")}{" "}
          <Link href="/contact" className="font-medium text-brand-500 hover:text-brand-400">
            {t("settings.workspace.tellUs")}
          </Link>{" "}
          {t("settings.workspace.roadmapLine3")}
        </p>
      </section>
    </div>
  );
}