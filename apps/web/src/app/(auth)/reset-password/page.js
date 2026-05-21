"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ResetPasswordPage() {
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
        if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
        if (password !== confirm) { setError("Passwords do not match"); return; }
        if (!token) { setError("Reset token missing — request a new link"); return; }
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || "Failed to reset password");
            setDone(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell
            title="Create new password"
            description="Choose a strong password to secure your FlexFlow account."
        >
            {done ? (
                <div className="space-y-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-(--text-primary)">Password updated</h3>
                        <p className="mt-2 text-sm text-(--text-secondary)">
                            Your password has been changed. You can now sign in with your new credentials.
                        </p>
                    </div>
                    <Button asChild className="w-full">
                        <Link href="/login">Sign in</Link>
                    </Button>
                </div>
            ) : !token ? (
                <div className="space-y-4 text-center">
                    <p className="text-sm text-(--text-muted)">Invalid or missing reset link.</p>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/forgot-password">Request a new link</Link>
                    </Button>
                </div>
            ) : (
                <form onSubmit={onSubmit} className="space-y-5">
                    <FormField id="password" label="New password">
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPw ? "text" : "password"}
                                placeholder="At least 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pr-10"
                                required
                            />
                            <button
                                type="button"
                                aria-label={showPw ? "Hide password" : "Show password"}
                                onClick={() => setShowPw((s) => !s)}
                                className="absolute top-1/2 right-3 -translate-y-1/2 text-(--text-muted) hover:text-(--text-secondary)"
                            >
                                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </FormField>

                    <FormField id="confirm" label="Confirm password">
                        <Input
                            id="confirm"
                            type="password"
                            placeholder="Re-enter password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                        />
                    </FormField>

                    {error && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                    )}

                    <Button type="submit" className="w-full" isLoading={loading}>
                        Update password
                    </Button>
                </form>
            )}
        </AuthShell>
    );
}
