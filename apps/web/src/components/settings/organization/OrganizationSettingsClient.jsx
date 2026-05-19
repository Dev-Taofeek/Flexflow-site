"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Building2, ImagePlus, Trash2 } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function OrganizationSettingsClient() {
  const logoInputRef = useRef(null);

  const [organizationName, setOrganizationName] = useState("Acme Workspace");
  const [logoPreview, setLogoPreview] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
  }

  function handleSave(event) {
    event.preventDefault();
  }

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-11 w-11 items-center justify-center rounded-2xl">
            <Building2 className="h-5 w-5" strokeWidth={1.7} />
          </div>

          <div>
            <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Organization profile
            </h2>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
              Update your organization identity and workspace branding.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="organizationName"
              className="text-foreground dark:text-foreground-dark text-sm font-medium"
            >
              Organization name
            </label>

            <Input
              id="organizationName"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <p className="text-foreground dark:text-foreground-dark text-sm font-medium">
              Organization logo
            </p>

            <div className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-3 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center">
              <Avatar src={logoPreview} fallback={organizationName.slice(0, 2)} size="xl" />

              <div className="flex-1">
                <p className="text-foreground dark:text-foreground-dark text-sm">
                  Upload a square PNG, JPG, or WebP logo. Recommended size is 512×512.
                </p>

                <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs">
                  This appears in the sidebar, invites, and workspace switcher.
                </p>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={1.7} />
                  Upload logo
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </section>

      <section className="border-danger-500/30 bg-danger-500/5 dark:bg-danger-500/10 rounded-3xl border p-6">
        <div className="flex items-start gap-3">
          <div className="bg-danger-500/10 text-danger-600 dark:text-danger-400 flex h-11 w-11 items-center justify-center rounded-2xl">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.7} />
          </div>

          <div className="flex-1">
            <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Danger zone
            </h2>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm leading-relaxed">
              Deleting this organization permanently removes all projects, issues, comments,
              members, and audit logs.
            </p>

            <div className="mt-5 max-w-md">
              <label
                htmlFor="deleteConfirm"
                className="text-foreground dark:text-foreground-dark text-sm font-medium"
              >
                Type DELETE to confirm
              </label>

              <Input
                id="deleteConfirm"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="DELETE"
                className="mt-2"
              />
            </div>

            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirm !== "DELETE"}
              className="mt-5"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.7} />
              Delete organization
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
