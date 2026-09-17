"use client";

import Image from "next/image";
import { Building2 } from "lucide-react";

import { useI18n } from "@/i18n";
import { Translated } from "@/lib/translate";

const ROLE_COLORS = {
  OWNER: "bg-brand-50 text-brand-700 border-brand-200",
  ADMIN: "bg-violet-50 text-violet-700 border-violet-200",
  MEMBER: "bg-slate-50 text-slate-700 border-slate-200",
  VIEWER: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

const ROLE_KEYS = {
  OWNER: "settings.organization.roleOwner",
  ADMIN: "settings.organization.roleAdmin",
  MEMBER: "settings.organization.roleMember",
  VIEWER: "settings.organization.roleViewer",
};

function RoleBadge({ role }) {
  const { t } = useI18n();
  const key = String(role || "").toUpperCase();
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        ROLE_COLORS[key] || ROLE_COLORS.MEMBER,
      ].join(" ")}
    >
      {t(ROLE_KEYS[key] || "settings.organization.roleMember")}
    </span>
  );
}

function OrgCard({ org }) {
  const { t } = useI18n();
  return (
    <div className="overflow-hidden rounded-xl border border-(--border) bg-(--bg-elevated)">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-600 text-xs font-bold text-white">
          {org.logoUrl ? (
            <Image src={org.logoUrl} alt="" width={36} height={36} className="h-9 w-9 object-cover" />
          ) : (
            org.name?.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-(--text-primary)">
            <Translated>{org.name}</Translated>
          </p>
          <p className="truncate text-xs text-(--text-muted)">{t("profile.roleInOrg")}</p>
        </div>
        <RoleBadge role={org.role} />
      </div>

      {(org.workspaces?.length || 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-(--border) px-4 py-2.5">
          {org.workspaces.map((ws) => (
            <span
              key={ws.id}
              className={[
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs",
                ROLE_COLORS[String(ws.role || org.role).toUpperCase()] || ROLE_COLORS.MEMBER,
              ].join(" ")}
            >
              <Building2 className="h-3 w-3 opacity-70" />
              <Translated>{ws.name}</Translated>
              <span className="opacity-70">·</span>
              {t(ROLE_KEYS[String(ws.role || org.role).toUpperCase()] || "settings.organization.roleMember")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileTeamRoles({ organizations = [] }) {
  const { t } = useI18n();

  if (organizations.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-(--text-primary)">{t("profile.rolesTitle")}</h2>
        <p className="mt-0.5 text-sm text-(--text-muted)">{t("profile.rolesDescription")}</p>
      </div>

      <div className="space-y-3">
        {organizations.map((org) => (
          <OrgCard key={org.id} org={org} />
        ))}
      </div>
    </section>
  );
}