"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useApp } from "@/contexts/AppContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useToast } from "@/contexts/ToastContext";
import { fetchRolesData, createRole, deleteRole } from "@/lib/roles-api";
import { useI18n } from "@/i18n";

export default function RolesSettingsPage() {
  const { currentWorkspace, accessToken, isReady } = useApp();
  const { t } = useI18n();
  const { addToast } = useToast();
  const { can } = useEntitlements();
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadFlag, setReloadFlag] = useState(0);

  const canEditMatrix = can("customizable_permissions");
  const canCustomRoles = can("custom_roles");
  const canManageRoles = Boolean(response?.canEdit && canEditMatrix && canCustomRoles);

  useEffect(() => {
    if (!isReady || !currentWorkspace?.id || !accessToken) return;
    let cancelled = false;
    fetchRolesData(currentWorkspace.id, accessToken)
      .then((data) => {
        if (!cancelled) setResponse(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentWorkspace?.id, isReady, reloadFlag]);

  async function handleDeleteRole(roleMeta) {
    if (!window.confirm(t("settings.roles.deleteConfirm", { role: roleMeta.name }))) return;
    setLoading(true);
    try {
      await deleteRole({ workspaceId: currentWorkspace.id, roleId: roleMeta.id, token: accessToken });
      setReloadFlag((prev) => prev + 1);
    } catch (err) {
      setLoading(false);
      addToast(err.message || t("settings.roles.deleteFailed"), "error");
    }
  }

  async function handleCreateRole(payload) {
    setLoading(true);
    try {
      await createRole({ workspaceId: currentWorkspace.id, token: accessToken, ...payload });
      setReloadFlag((prev) => prev + 1);
    } catch (err) {
      setLoading(false);
      addToast(err.message, "error");
      throw err;
    }
  }

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-brand-600 dark:text-brand-400 text-sm font-medium">{t("settings.roles.breadcrumb")}</p>

            <h1 className="text-foreground dark:text-foreground-dark mt-2 text-3xl font-semibold tracking-tight">
              {t("settings.roles.title")}
            </h1>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-3 max-w-2xl text-sm leading-relaxed">
              {t("settings.roles.description")}
            </p>
          </div>

          {canManageRoles && !loading && <CreateRoleModal onCreate={handleCreateRole} disabled={loading} />}
        </div>
      </section>

      {loading ? (
        <div className="h-80 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <UpgradePrompt
            feature="customizable_permissions"
            title={t("settings.roles.upgradeTitle")}
            description={t("settings.roles.upgradeDescription")}
          />
          <PermissionMatrix
            workspaceId={currentWorkspace.id}
            token={accessToken}
            roles={response.roles}
            roleMeta={response.roleMeta}
            resources={response.resources}
            initialPermissions={response.permissions}
            canEdit={response.canEdit && canEditMatrix}
            canDeleteRoles={canManageRoles}
            onDeleteRole={handleDeleteRole}
          />
        </>
      )}
    </div>
  );
}

function CreateRoleModal({ onCreate, disabled }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);

  function toggleResource(resource, action) {
    setPermissions((current) => {
      const actions = current[resource] || [];
      return {
        ...current,
        [resource]: actions.includes(action) ? actions.filter((a) => a !== action) : [...actions, action],
      };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate({ name, description, permissions });
      setName("");
      setDescription("");
      setPermissions({});
      setOpen(false);
    } catch {
      // toast handled by the page
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400 text-white inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        {t("settings.roles.createRole")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form onSubmit={submit} className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark w-full max-w-lg rounded-3xl border p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">{t("settings.roles.createTitle")}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-(--text-primary)">
              {t("settings.roles.roleName")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                autoFocus
                className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </label>

            <label className="mt-3 block text-sm font-medium text-(--text-primary)">
              {t("settings.roles.roleDescription")}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={300}
                className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </label>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-(--text-primary)">{t("settings.roles.permissionsLabel")}</legend>
              <div className="border-border dark:border-border-dark mt-2 max-h-56 space-y-3 overflow-y-auto rounded-2xl border p-4">
                {[
                  { id: "projects", label: "Projects", actions: ["create", "read", "update", "delete"] },
                  { id: "tasks", label: "Tasks", actions: ["create", "read", "update", "delete"] },
                  { id: "comments", label: "Comments", actions: ["create", "read", "update", "delete"] },
                  { id: "team", label: "Team", actions: ["invite", "read", "update", "remove"] },
                  { id: "settings", label: "Settings", actions: ["read", "update", "billing", "danger_zone"] },
                  { id: "roles", label: "Roles & Permissions", actions: ["read", "update"] },
                ].map((resource) => (
                  <div key={resource.id}>
                    <p className="text-muted-foreground dark:text-muted-foreground-dark text-xs font-semibold tracking-wide uppercase">{resource.label}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {resource.actions.map((action) => {
                        const checked = (permissions[resource.id] || []).includes(action);
                        return (
                          <button
                            key={action}
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => toggleResource(resource.id, action)}
                            className={[
                              "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                              checked
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-border text-muted-foreground hover:border-brand-500 hover:text-brand-600 dark:border-border-dark dark:text-muted-foreground-dark",
                            ].join(" ")}
                          >
                            {action.replaceAll("_", " ")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-border text-muted-foreground hover:text-foreground dark:border-border-dark rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
              >
                {t("settings.roles.cancel")}
              </button>
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "…" : t("settings.roles.createRole")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}