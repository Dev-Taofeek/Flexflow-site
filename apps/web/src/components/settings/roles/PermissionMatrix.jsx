"use client";

import { useState } from "react";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { updatePermission } from "@/lib/roles-api";

export function PermissionMatrix({ roles, resources, initialPermissions }) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [savingKey, setSavingKey] = useState("");

  async function handleToggle({ role, resource, action }) {
    const currentActions = permissions[role]?.[resource] || [];
    const enabled = !currentActions.includes(action);
    const key = `${role}-${resource}-${action}`;

    setSavingKey(key);

    setPermissions((current) => ({
      ...current,
      [role]: {
        ...current[role],
        [resource]: enabled
          ? Array.from(new Set([...currentActions, action]))
          : currentActions.filter((item) => item !== action),
      },
    }));

    const response = await updatePermission({
      role,
      resource,
      action,
      enabled,
    });

    setPermissions(response.data.permissions);
    setSavingKey("");
  }

  return (
    <section className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark rounded-3xl border p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-11 w-11 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
            </div>

            <div>
              <h2 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
                Permission matrix
              </h2>

              <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-sm">
                Toggle which roles can perform each action across core FlexFlow resources.
              </p>
            </div>
          </div>
        </div>

        <Badge variant="secondary">{roles.length} roles</Badge>
      </div>

      <div className="border-border dark:border-border-dark mt-8 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-245 border-collapse">
          <thead className="bg-muted dark:bg-muted-dark">
            <tr>
              <th className="text-muted-foreground dark:text-muted-foreground-dark w-55 px-4 py-4 text-left text-xs font-semibold tracking-wide uppercase">
                Resource action
              </th>

              {roles.map((role) => (
                <th
                  key={role}
                  className="text-muted-foreground dark:text-muted-foreground-dark px-4 py-4 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  {role}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-border bg-background dark:divide-border-dark dark:bg-background-dark divide-y">
            {resources.map((resource) =>
              resource.actions.map((action, actionIndex) => (
                <tr key={`${resource.id}-${action}`}>
                  <td className="px-4 py-4">
                    <div>
                      {actionIndex === 0 ? (
                        <p className="text-foreground dark:text-foreground-dark text-sm font-semibold">
                          {resource.label}
                        </p>
                      ) : null}

                      <p className="text-muted-foreground dark:text-muted-foreground-dark mt-1 text-xs font-medium tracking-wide uppercase">
                        {action.replaceAll("_", " ")}
                      </p>
                    </div>
                  </td>

                  {roles.map((role) => {
                    const isEnabled = permissions[role]?.[resource.id]?.includes(action);
                    const key = `${role}-${resource.id}-${action}`;
                    const isSaving = savingKey === key;

                    return (
                      <td key={key} className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggle({
                              role,
                              resource: resource.id,
                              action,
                            })
                          }
                          disabled={isSaving}
                          className={[
                            "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                            "focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none",
                            isEnabled
                              ? "border-brand-500 bg-brand-600 dark:bg-brand-500 text-white"
                              : "border-border bg-surface text-muted-foreground hover:border-brand-500 hover:text-brand-600 dark:border-border-dark dark:bg-surface-dark dark:text-muted-foreground-dark dark:hover:text-brand-400",
                            isSaving ? "opacity-60" : "",
                          ].join(" ")}
                          aria-label={`${isEnabled ? "Disable" : "Enable"} ${role} ${action} ${resource.label} permission`}
                        >
                          {isEnabled ? (
                            <Check className="h-4 w-4" strokeWidth={1.8} />
                          ) : (
                            <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
