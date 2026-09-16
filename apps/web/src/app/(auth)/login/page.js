"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { DemoAccessButton } from "@/components/auth/DemoAccessButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginSchema } from "@/lib/auth/schemas";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

// Straight to the API — lets the login page tell a 2FA requirement apart from
// bad credentials (NextAuth collapses both into "CredentialsSignin").
async function probeLogin({ email, password, code }) {
  try {
    const res = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, ...(code ? { code } : {}) }),
    });
    const json = await res.json();
    if (json.success && json.data?.requiresTwoFactor) return { requiresTwoFactor: true };
    return { errorCode: json.error === "INVALID_CODE" ? json.error : null };
  } catch {
    return {};
  }
}

function LoginForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const ERROR_MESSAGES = {
    CredentialsSignin: t("auth.invalidCredentials"),
    session_expired: t("auth.sessionExpired"),
    OAuthAccountNotLinked: t("auth.emailLinkedToAnotherMethod"),
  };

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(
    urlError ? (ERROR_MESSAGES[urlError] ?? t("auth.signInFailed")) : ""
  );
  const [step, setStep] = useState("password"); // "password" | "two-factor"
  const [pending, setPending] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values) {
    setAuthError("");
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (!result?.error) {
      addToast(t("auth.signedIn"), "success");
      router.push(callbackUrl);
      return;
    }

    const probe = await probeLogin({ email: values.email, password: values.password });
    if (probe.requiresTwoFactor) {
      setPending({ email: values.email, password: values.password });
      setTwoFactorCode("");
      setStep("two-factor");
      return;
    }

    const message = t("auth.invalidCredentials");
    setAuthError(message);
    addToast(message, "error");
  }

  async function onSubmitCode(e) {
    e.preventDefault();
    if (twoFactorCode.length !== 6) return;
    setAuthError("");

    const result = await signIn("credentials", {
      email: pending.email,
      password: pending.password,
      code: twoFactorCode,
      redirect: false,
    });
    if (!result?.error) {
      addToast(t("auth.signedIn"), "success");
      router.push(callbackUrl);
      return;
    }

    const probe = await probeLogin({ email: pending.email, password: pending.password, code: twoFactorCode });
    const message = probe.errorCode === "INVALID_CODE"
      ? t("auth.invalidOrExpiredCode")
      : t("auth.signInFailed");
    setAuthError(message);
    addToast(message, "error");
  }

  function backToPasswordStep() {
    setStep("password");
    setPending(null);
    setTwoFactorCode("");
    setAuthError("");
  }

  if (step === "two-factor") {
return (
      <AuthShell
        title={t("auth.enterCode")}
        description={t("auth.enterCodeDescription")}
      >
        <div className="space-y-6">
          {authError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {authError}
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground dark:border-border-dark dark:bg-surface-dark dark:text-muted-foreground-dark">
            {t("auth.twoFactor.helper", { email: pending?.email })}
          </div>

          <form onSubmit={onSubmitCode} className="space-y-5">
            <FormField id="code" label={t("auth.authenticatorCode")}>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t("auth.codePlaceholder")}
                className="text-center tracking-[0.3em]"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </FormField>

            <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={twoFactorCode.length !== 6}>
              {t("auth.verifyAndSignIn")}
            </Button>
          </form>

          <div className="flex items-center justify-between text-center text-sm">
            <button
              type="button"
              onClick={backToPasswordStep}
              className="text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark font-medium transition-colors"
            >
              {t("common.back")}
            </button>
            <Link
              href="/contact"
              className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
            >
              {t("auth.lostAuthenticator")}
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("auth.welcomeBack")}
      description={t("auth.signInDescription")}
    >
      <div className="space-y-6">
        {authError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {authError}
          </div>
        )}

        <OAuthButtons callbackUrl={callbackUrl} />

        <DemoAccessButton callbackUrl={callbackUrl} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="border-border dark:border-border-dark w-full border-t" />
          </div>
<div className="relative flex justify-center">
            <span className="bg-surface text-muted-foreground dark:bg-surface-dark dark:text-muted-foreground-dark px-3 text-xs tracking-[0.2em] uppercase">
              {t("auth.orContinueWithEmail")}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField id="email" label={t("auth.email")} error={errors.email}>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              isInvalid={Boolean(errors.email)}
              {...register("email")}
            />
          </FormField>

          <FormField id="password" label={t("auth.password")} error={errors.password}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.passwordPlaceholder")}
                className="pr-12"
                isInvalid={Boolean(errors.password)}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                className="text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center justify-center transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <div className="flex items-center justify-between">
            <label className="text-muted-foreground dark:text-muted-foreground-dark flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="border-border text-brand-600 focus:ring-brand-500 dark:border-border-dark dark:bg-background-dark h-4 w-4 rounded"
              />
              {t("auth.rememberMe")}
            </label>
            <Link
              href="/forgot-password"
              className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 text-sm font-medium transition-colors"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>

          <motion.div whileTap={{ scale: 0.995 }}>
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              {t("common.signIn")}
            </Button>
          </motion.div>
        </form>

        <p className="text-muted-foreground dark:text-muted-foreground-dark text-center text-sm">
          {t("auth.noAccount")}{" "}
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
          >
            {t("auth.createOne")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={
      <AuthShell title={t("auth.welcomeBack")} description={t("auth.suspense.signInDescription")}>
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </AuthShell>
    }>
      <LoginForm />
    </Suspense>
  );
}
