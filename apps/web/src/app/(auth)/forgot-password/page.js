"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { forgotPasswordSchema } from "@/lib/auth/schemas";

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit() {
    setIsSubmitted(true);
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we’ll send you a secure password reset link."
    >
      {isSubmitted ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-12 w-12 items-center justify-center rounded-xl">
            <Mail className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-foreground dark:text-foreground-dark text-lg font-semibold">
              Check your inbox
            </h3>

            <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm leading-relaxed">
              If an account exists for that email, you’ll receive a password reset link shortly.
            </p>
          </div>

          <Button asChild className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormField id="email" label="Email" error={errors.email}>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              isInvalid={Boolean(errors.email)}
              {...register("email")}
            />
          </FormField>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Send reset link
          </Button>

          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground dark:text-muted-foreground-dark dark:hover:text-foreground-dark inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
