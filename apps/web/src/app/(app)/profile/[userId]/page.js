"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AtSign } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { apiRequest } from "@/lib/api-client";
import { useI18n } from "@/i18n";
import { ProfileTeamRoles } from "@/components/profile/ProfileTeamRoles";

export default function TeamMemberProfilePage() {
    const { userId } = useParams();
    const router = useRouter();
    const { accessToken, user, isReady } = useApp();
    const { t } = useI18n();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!accessToken || !isReady || !userId) return;
        if (userId === user?.id) {
            router.replace("/profile");
            return;
        }
        let cancelled = false;
        apiRequest(`/profile/${userId}`, { token: accessToken })
            .then((data) => {
                if (cancelled) return;
                if (data.user?.id === user?.id) {
                    router.replace("/profile");
                    return;
                }
                setError(null);
                setProfile(data);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [userId, isReady, accessToken, user?.id, router]);

    if (loading || !isReady) {
        return (
            <div className="space-y-4">
                <div className="h-32 animate-pulse rounded-xl bg-(--border)" />
                <div className="h-48 animate-pulse rounded-xl bg-(--border)" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-8 text-center">
                <p className="text-sm text-(--text-muted)">{error || t("profile.notFound")}</p>
                <Link
                    href="/team"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t("profile.backToTeam")}
                </Link>
            </div>
        );
    }

    const p = profile.user;

    return (
        <div className="space-y-6 max-w-3xl">
            <Link
                href="/team"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)"
            >
                <ArrowLeft className="h-4 w-4" />
                {t("profile.backToTeam")}
            </Link>

            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                        {p.avatarUrl ? (
                            <Image src={p.avatarUrl} alt={p.name} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
                        ) : (
                            p.name?.slice(0, 2).toUpperCase() || "U"
                        )}
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-xl font-semibold text-(--text-primary)">{p.name}</h1>
                        <p className="flex items-center gap-1 truncate text-sm text-(--text-muted)">
                            <AtSign className="h-3.5 w-3.5" />
                            {p.email}
                        </p>
                    </div>
                </div>

                {p.bio && (
                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-(--text-secondary)">{p.bio}</p>
                )}
                {p.timezone && (
                    <p className="mt-3 text-xs text-(--text-muted)">
                        {t("profile.timezone")}: {p.timezone}
                    </p>
                )}
            </section>

            <ProfileTeamRoles organizations={profile.organizations || []} />
        </div>
    );
}