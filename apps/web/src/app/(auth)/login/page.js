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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginSchema } from "@/lib/auth/schemas";

const ERROR_MESSAGES = {
  CredentialsSignin: "Invalid email or password.",
  session_expired: "Your session expired — please sign in again.",
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(
    urlError ? (ERROR_MESSAGES[urlError] ?? "Sign-in failed — please try again.") : ""
  );

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
    if (result?.error) {
      setAuthError(ERROR_MESSAGES[result.error] ?? "Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your workspace and continue managing projects with your team."
    >
      <div className="space-y-6">
        {authError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {authError}
          </div>
        )}

        <OAuthButtons />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="border-border dark:border-border-dark w-full border-t" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-surface text-muted-foreground dark:bg-surface-dark dark:text-muted-foreground-dark px-3 text-xs tracking-[0.2em] uppercase">
              Or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField id="email" label="Email" error={errors.email}>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              isInvalid={Boolean(errors.email)}
              {...register("email")}
            />
          </FormField>

          <FormField id="password" label="Password" error={errors.password}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="pr-12"
                isInvalid={Boolean(errors.password)}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center justify-center transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">Toggle password visibility</span>
              </button>
            </div>
          </FormField>

          <div className="flex items-center justify-between">
            <label className="text-muted-foreground dark:text-muted-foreground-dark flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="border-border text-brand-600 focus:ring-brand-500 dark:border-border-dark dark:bg-background-dark h-4 w-4 rounded"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 text-sm font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <motion.div whileTap={{ scale: 0.995 }}>
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Sign in
            </Button>
          </motion.div>
        </form>

        <p className="text-muted-foreground dark:text-muted-foreground-dark text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthShell title="Welcome back" description="Sign in to your workspace.">
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </AuthShell>
    }>
      <LoginForm />
    </Suspense>
  );
}
