"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

import { AuthShell } from "@/components/auth/AuthShell";
import { FormField } from "@/components/auth/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = "Full name is required";
    if (!form.email.includes("@")) errors.email = "Valid email is required";
    if (form.password.length < 8) errors.password = "Password must be at least 8 characters";
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
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Registration failed");

      // Sign in immediately after registration
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) throw new Error("Auto-login failed — please sign in manually");
      router.push("/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Get started with FlexFlow — manage projects and collaborate with your team."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormField
          id="name"
          label="Full name"
          error={fieldErrors.name ? { message: fieldErrors.name } : undefined}
        >
          <Input
            id="name"
            type="text"
            placeholder="Jane Smith"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            isInvalid={Boolean(fieldErrors.name)}
          />
        </FormField>

        <FormField
          id="email"
          label="Work email"
          error={fieldErrors.email ? { message: fieldErrors.email } : undefined}
        >
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            isInvalid={Boolean(fieldErrors.email)}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          error={fieldErrors.password ? { message: fieldErrors.password } : undefined}
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="pr-10"
              isInvalid={Boolean(fieldErrors.password)}
            />
            <button
              type="button"
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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </Button>

        <p className="text-center text-sm text-(--text-muted)">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 transition-colors hover:text-indigo-500"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
