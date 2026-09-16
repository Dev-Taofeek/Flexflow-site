"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

function ResetPasswordForm() {
  const { addToast } = useToast();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setError(t("auth.error.passwordMin")); return; }
    if (password !== confirm) { setError(t("auth.reset.passwordsMismatch")); return; }
    if (!token) { setError(t("auth.reset.missingToken")); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || t("auth.reset.failedToReset"));
      setDone(true);
      addToast(t("auth.reset.successToast"), "success");
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.reset.title")}
      description={t("auth.reset.description")}
    >
      {done ? (
        <div className="space-y-6">
          <div className="bg-success-50 text-success-600 flex h-12 w-12 items-center justify-center rounded-xl">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-(--text-primary)">{t("auth.reset.updated")}</h3>
            <p className="mt-2 text-sm text-(--text-secondary)">
              {t("auth.reset.updatedDescription")}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/login">{t("common.signIn")}</Link>
          </Button>
        </div>
      ) : !token ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-(--text-muted)">{t("auth.reset.invalidLink")}</p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/forgot-password">{t("auth.reset.requestNewLink")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <FormField id="password" label={t("auth.reset.newPassword")}>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder={t("auth.passwordMinPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
              />
              <button
                type="button"
                aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
                onClick={() => setShowPw((s) => !s)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-(--text-muted) hover:text-(--text-secondary)"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <FormField id="confirm" label={t("auth.reset.confirmPassword")}>
            <Input
              id="confirm"
              type="password"
              placeholder={t("auth.reset.reenterPassword")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </FormField>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            {t("auth.reset.updatePassword")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={
      <AuthShell title={t("auth.reset.title")} description={t("auth.suspense.resetDescription")}>
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
      </AuthShell>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
