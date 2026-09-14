"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, Loader2, MailCheck, TriangleAlert } from "lucide-react";

import { apiUrl } from "@/lib/api-url";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/Button";

export function JoinInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const callbackUrl = useMemo(() => `/join?token=${encodeURIComponent(token)}`, [token]);
  const { data: session, status, update } = useSession();
  const { refreshOrganizations } = useApp();
  const { addToast } = useToast();
  const [state, setState] = useState({ loading: false, error: "", joined: false });

  useEffect(() => {
    if (!token || status !== "authenticated" || state.loading || state.joined) return;

    async function acceptInvite() {
      setState({ loading: true, error: "", joined: false });
      try {
        const res = await fetch(apiUrl("/organizations/join"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.user.accessToken}`,
          },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Failed to accept invitation");
        }

        await update({ onboarded: true });
        await refreshOrganizations();
        addToast("Invitation accepted.", "success");
        setState({ loading: false, error: "", joined: true });
        router.replace("/dashboard");
      } catch (error) {
        setState({ loading: false, error: error.message, joined: false });
        addToast(error.message, "error");
      }
    }

    acceptInvite();
  }, [addToast, refreshOrganizations, router, session?.user?.accessToken, state.joined, state.loading, status, token, update]);

  if (!token) {
    return (
      <JoinCard
        icon={<TriangleAlert className="h-5 w-5" />}
        title="Invalid invitation link"
        description="This invitation link is missing its token. Ask your teammate to resend the invite."
      />
    );
  }

  if (status === "loading" || state.loading) {
    return (
      <JoinCard
        icon={<Loader2 className="h-5 w-5 animate-spin" />}
        title="Accepting invitation"
        description="Hold on while FlexFlow adds you to the organization."
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <JoinCard
        icon={<MailCheck className="h-5 w-5" />}
        title="Join this FlexFlow team"
        description="Sign in or create an account with the invited email address to accept this invitation."
      >
        <div className="mt-6 grid gap-3">
          <Button asChild className="w-full">
            <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Create account
            </Link>
          </Button>
        </div>
      </JoinCard>
    );
  }

  if (state.error) {
    return (
      <JoinCard
        icon={<TriangleAlert className="h-5 w-5" />}
        title="Could not accept invitation"
        description={state.error}
      >
        <button
          type="button"
          onClick={() => setState({ loading: false, error: "", joined: false })}
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
        >
          Try again
        </button>
      </JoinCard>
    );
  }

  return (
    <JoinCard
      icon={<MailCheck className="h-5 w-5" />}
      title="Invitation accepted"
      description="Redirecting you to your dashboard."
    />
  );
}

function JoinCard({ icon, title, description, children }) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-surface dark:border-border-dark dark:bg-surface-dark w-full max-w-md rounded-3xl border p-8 shadow-md">
        <div className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 mb-5 flex h-11 w-11 items-center justify-center rounded-xl">
          {icon}
        </div>
        <h1 className="text-foreground dark:text-foreground-dark text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground dark:text-muted-foreground-dark mt-2 text-sm leading-6">
          {description}
        </p>
        {children}
      </div>
    </main>
  );
}
