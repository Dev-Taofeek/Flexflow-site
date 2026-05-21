"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        if (!email.includes("@")) { setError("Enter a valid email address"); return; }
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || "Failed to send reset email");
            setSubmitted(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell
            title="Reset your password"
            description="Enter your email and we'll send you a secure password reset link."
        >
            {submitted ? (
                <div className="space-y-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Mail className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-(--text-primary)">Check your inbox</h3>
                        <p className="mt-2 text-sm text-(--text-secondary)">
                            If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
                        </p>
                    </div>
                    <Button asChild className="w-full">
                        <Link href="/login">Back to login</Link>
                    </Button>
                </div>
            ) : (
                <form onSubmit={onSubmit} className="space-y-6">
                    <FormField id="email" label="Email">
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </FormField>

                    {error && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                    )}

                    <Button type="submit" className="w-full" isLoading={loading}>
                        Send reset link
                    </Button>

                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-sm font-medium text-(--text-muted) transition-colors hover:text-(--text-primary)"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to login
                    </Link>
                </form>
            )}
        </AuthShell>
    );
}
