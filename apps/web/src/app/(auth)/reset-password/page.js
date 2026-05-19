"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { resetPasswordSchema } from "@/lib/auth/schemas";

export default function ResetPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit() {
    setIsSubmitted(true);
  }

  return (
    <AuthShell
      title="Create new password"
      description="Choose a strong password to secure your FlexFlow account."
    >
      {isSubmitted ? (
        <motion.div
          initial={{
            opacity: 0,
            y: 16,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.25,
            ease: "easeOut",
          }}
          className="space-y-6"
        >
          <div className="bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300 flex h-12 w-12 items-center justify-center rounded-xl">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Password updated
            </h3>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm leading-relaxed">
              Your password has been changed successfully. You can now sign in with your new
              credentials.
            </p>
          </div>

          <Button className="w-full">
            <Link href="/login">Continue to login</Link>
          </Button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-12 w-12 items-center justify-center rounded-xl">
            <LockKeyhole className="h-5 w-5" />
          </div>

          <FormField id="password" label="New password" error={errors.password}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a strong password"
                className="pr-12"
                isInvalid={Boolean(errors.password)}
                {...register("password")}
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                className="text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center justify-center transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}

                <span className="sr-only">Toggle password visibility</span>
              </button>
            </div>
          </FormField>

          <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                className="pr-12"
                isInvalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((previous) => !previous)}
                className="text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center justify-center transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}

                <span className="sr-only">Toggle confirm password visibility</span>
              </button>
            </div>
          </FormField>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
