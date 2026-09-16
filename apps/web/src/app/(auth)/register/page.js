"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { t } = useI18n();
  const callbackUrl = searchParams.get("callbackUrl") || "/onboarding";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = t("auth.error.fullNameRequired");
    if (!form.email.includes("@")) errors.email = t("auth.error.validEmailRequired");
    if (form.password.length < 8) errors.password = t("auth.error.passwordMin");
    return errors;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || t("auth.error.registrationFailed"));

      // Sign in immediately after registration
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) throw new Error(t("auth.error.autoLoginFailed"));
      addToast(t("auth.toast.accountCreated"), "success");
      router.push(callbackUrl);
    } catch (err) {
      setError(err.message);
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.createAccount")}
      description={t("auth.createAccountDescription")}
    >
      <div className="space-y-5">
        <OAuthButtons callbackUrl={callbackUrl} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="border-border dark:border-border-dark w-full border-t" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-surface text-muted-foreground px-3 text-xs tracking-[0.2em] uppercase dark:bg-surface-dark dark:text-muted-foreground-dark">
              {t("auth.orContinueWithEmail")}
            </span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
        <FormField
          id="name"
          label={t("auth.fullName")}
          error={fieldErrors.name ? { message: fieldErrors.name } : undefined}
        >
          <Input
            id="name"
            type="text"
            placeholder={t("auth.namePlaceholder")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            isInvalid={Boolean(fieldErrors.name)}
          />
        </FormField>

        <FormField
          id="email"
          label={t("auth.workEmail")}
          error={fieldErrors.email ? { message: fieldErrors.email } : undefined}
        >
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            isInvalid={Boolean(fieldErrors.email)}
          />
        </FormField>

        <FormField
          id="password"
          label={t("auth.password")}
          error={fieldErrors.password ? { message: fieldErrors.password } : undefined}
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.passwordMinPlaceholder")}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="pr-10"
              isInvalid={Boolean(fieldErrors.password)}
            />
            <button
              type="button"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-(--text-muted) transition-colors hover:text-(--text-secondary)"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" isLoading={loading}>
          {t("auth.createAccountButton")}
        </Button>

        <p className="text-muted-foreground text-center text-sm">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-brand-600 hover:text-brand-500 font-medium transition-colors"
          >
            {t("common.signIn")}
          </Link>
        </p>
      </form>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <AuthShell title={t("auth.createAccount")} description={t("auth.suspense.createAccountDescription")}>
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </AuthShell>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
