"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, Loader2, MailCheck, TriangleAlert } from "lucide-react";

import { apiUrl } from "@/lib/api-url";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";

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
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="flex items-center justify-center rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Create account
          </Link>
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
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
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
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
        {children}
      </div>
    </main>
  );
}
