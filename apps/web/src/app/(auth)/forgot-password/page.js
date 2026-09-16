"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

export default function ForgotPasswordPage() {
    const { addToast } = useToast();
    const { t } = useI18n();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        if (!email.includes("@")) { setError(t("auth.forgot.enterValidEmail")); return; }
        setError("");
        setLoading(true);
        try {
            const res = await fetch(apiUrl("/auth/forgot-password"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || t("auth.forgot.failedToSend"));
            setSubmitted(true);
            addToast(t("auth.forgot.emailSentToast"), "success");
        } catch (err) {
            setError(err.message);
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell
            title={t("auth.forgot.title")}
            description={t("auth.forgot.description")}
        >
            {submitted ? (
                <div className="space-y-6">
                    <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 flex h-12 w-12 items-center justify-center rounded-xl">
                        <Mail className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-(--text-primary)">{t("auth.forgot.checkInbox")}</h3>
                        <p className="mt-2 text-sm text-(--text-secondary)">
                            {t("auth.forgot.checkInboxDescription", { email })}
                        </p>
                    </div>
                    <Button asChild className="w-full">
                        <Link href="/login">{t("auth.backToLogin")}</Link>
                    </Button>
                </div>
            ) : (
                <form onSubmit={onSubmit} className="space-y-6">
                    <FormField id="email" label={t("auth.email")}>
                        <Input
                            id="email"
                            type="email"
                            placeholder={t("auth.emailPlaceholder")}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </FormField>

                    {error && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                    )}

                    <Button type="submit" className="w-full" isLoading={loading}>
                        {t("auth.forgot.sendResetLink")}
                    </Button>

                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-sm font-medium text-(--text-muted) transition-colors hover:text-(--text-primary)"
                    >
                        <ArrowLeft className="h-4 w-4" /> {t("auth.backToLogin")}
                    </Link>
                </form>
            )}
        </AuthShell>
    );
}
