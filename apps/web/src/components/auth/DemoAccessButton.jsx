"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Play, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n";

/**
 * "Try the demo" — fetches the seeded demo account credentials from the
 * (env-gated) API, then signs in through the normal Credentials flow. No auth
 * bypass: the demo account is a real user record created by the seed script.
 */
export function DemoAccessButton({ callbackUrl = "/dashboard", className = "" }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function launchDemo() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/demo-credentials"), { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.warn("Demo unavailable:", json.error?.message);
        return;
      }
      const result = await signIn("credentials", {
        redirect: false,
        email: json.data.email,
        password: json.data.password,
        callbackUrl,
      });
      if (result?.ok) window.location.href = callbackUrl;
    } catch {
      // fall through — leave the user on the auth page
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={`w-full ${className}`}
      onClick={launchDemo}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      {t("auth.demoAccess")}
    </Button>
  );
}