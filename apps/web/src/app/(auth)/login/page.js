"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
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
import { apiRequest } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

// Straight to the API — lets the login page tell a 2FA requirement apart from
// bad credentials (NextAuth collapses both into "CredentialsSignin").
async function probeLogin({ email, password, code, rememberMe }) {
  try {
    const res = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(code ? { code } : {}),
        ...(rememberMe ? { rememberMe: true } : {}),
      }),
    });
    const json = await res.json();
    if (json.success && json.data?.requiresTwoFactor) return { requiresTwoFactor: true };
    if (json.requiresTwoFactorSetup) {
      return {
        requiresTwoFactorSetup: true,
        enrollmentToken: json.enrollmentToken,
        organizations: json.organizations || [],
      };
    }
    return { errorCode: json.error?.code === "INVALID_CODE" ? "INVALID_CODE" : null };
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
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState(
    urlError ? (ERROR_MESSAGES[urlError] ?? t("auth.signInFailed")) : ""
  );
  const [step, setStep] = useState("password"); // "password" | "two-factor" | "enroll"
  const [pending, setPending] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [enroll, setEnroll] = useState({
    token: "",
    organizations: [],
    qrCode: "",
    secret: "",
    loading: false,
    verifying: false,
    error: "",
  });
  const [enrollCode, setEnrollCode] = useState("");

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
      rememberMe,
      redirect: false,
    });
    if (!result?.error) {
      addToast(t("auth.signedIn"), "success");
      router.push(callbackUrl);
      return;
    }

    const probe = await probeLogin({ email: values.email, password: values.password, rememberMe });
    if (probe.requiresTwoFactorSetup) {
      setPending({ email: values.email, password: values.password });
      setEnroll({
        token: probe.enrollmentToken || "",
        organizations: probe.organizations || [],
        qrCode: "",
        secret: "",
        loading: false,
        verifying: false,
        error: "",
      });
      setEnrollCode("");
      setStep("enroll");
      startEnrollment(probe.enrollmentToken);
      return;
    }
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

  async function startEnrollment(enrollmentToken) {
    if (!enrollmentToken) return;
    setEnroll((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await apiRequest("/enrollment/2fa/setup", {
        method: "POST",
        token: enrollmentToken,
        toast: false,
      });
      setEnroll((s) => ({ ...s, loading: false, qrCode: data.qrCode, secret: data.secret }));
    } catch (err) {
      setEnroll((s) => ({ ...s, loading: false, error: err.message }));
    }
  }

  async function onEnrollVerify(e) {
    e.preventDefault();
    if (enrollCode.length !== 6 || !enroll.token) return;
    setEnroll((s) => ({ ...s, verifying: true, error: "" }));
    try {
      await apiRequest("/enrollment/2fa/verify", {
        method: "POST",
        token: enroll.token,
        body: { code: enrollCode },
        toast: false,
      });
      addToast(t("auth.twoFactor.enrolledToast"), "success");

      const result = await signIn("credentials", {
        email: pending?.email,
        password: pending?.password,
        code: enrollCode,
        rememberMe,
        redirect: false,
      });
      if (!result?.error) {
        addToast(t("auth.signedIn"), "success");
        router.push(callbackUrl);
        return;
      }
      backToPasswordStep();
    } catch (err) {
      setEnroll((s) => ({
        ...s,
        verifying: false,
        error: err.message || t("auth.twoFactor.enrollVerifyFailed"),
      }));
    }
  }

  async function onSubmitCode(e) {
    e.preventDefault();
    if (twoFactorCode.length !== 6) return;
    setAuthError("");

    const result = await signIn("credentials", {
      email: pending.email,
      password: pending.password,
      code: twoFactorCode,
      rememberMe,
      redirect: false,
    });
    if (!result?.error) {
      addToast(t("auth.signedIn"), "success");
      router.push(callbackUrl);
      return;
    }

    const probe = await probeLogin({ email: pending.email, password: pending.password, code: twoFactorCode, rememberMe });
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
    setEnrollCode("");
    setEnroll({ token: "", organizations: [], qrCode: "", secret: "", loading: false, verifying: false, error: "" });
    setAuthError("");
  }

  if (step === "enroll") {
    const orgNames = (enroll.organizations || []).map((o) => o.name).join(", ");
    return (
      <AuthShell
        title={t("auth.twoFactor.enrollRequired")}
        description={t("auth.twoFactor.enrollRequiredDescription")}
      >
        <div className="space-y-6">
          {orgNames ? (
            <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground dark:border-border-dark dark:bg-surface-dark dark:text-muted-foreground-dark">
              {t("auth.twoFactor.enrollOrgList", { orgs: orgNames })}
            </div>
          ) : null}

          {enroll.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {enroll.error}
            </div>
          ) : null}

          {enroll.loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ) : enroll.qrCode ? (
            <>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
                {t("auth.twoFactor.enrollScanQr")}
              </p>
              <div className="flex justify-center">
                <Image
                  src={enroll.qrCode}
                  alt={t("auth.twoFactor.enrollRequired")}
                  width={180}
                  height={180}
                  className="rounded-xl border border-border dark:border-border-dark"
                />
              </div>
              <p className="break-all text-center text-xs text-muted-foreground dark:text-muted-foreground-dark">
                {t("auth.twoFactor.enrollManualKey")}: <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">{enroll.secret}</code>
              </p>
              <form onSubmit={onEnrollVerify} className="space-y-5">
                <FormField id="enroll-code" label={t("auth.authenticatorCode")}>
                  <Input
                    id="enroll-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder={t("auth.codePlaceholder")}
                    className="text-center tracking-[0.3em]"
                    value={enrollCode}
                    onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                </FormField>
                <Button type="submit" className="w-full" isLoading={enroll.verifying} disabled={enrollCode.length !== 6}>
                  {t("auth.twoFactor.enrollVerify")}
                </Button>
              </form>
            </>
          ) : null}

          <div className="text-center">
            <button
              type="button"
              onClick={backToPasswordStep}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark"
            >
              {t("auth.twoFactor.enrollBackToSignIn")}
            </button>
          </div>
        </div>
      </AuthShell>
    );
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
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
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
