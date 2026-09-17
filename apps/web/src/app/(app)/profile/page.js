"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/api-client";
import { useI18n } from "@/i18n";
import { ProfileTeamRoles } from "@/components/profile/ProfileTeamRoles";

const inputCls = "w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none";

export default function OwnProfilePage() {
    const { data: session, update } = useSession();
    const { accessToken, organizations, isReady } = useApp();
    const { addToast } = useToast();
    const { t } = useI18n();

    const user = session?.user;
    const avatarRef = useRef(null);

    const [name, setName] = useState(user?.name || "");
    const [bio, setBio] = useState("");
    const [avatarPreview, setAvatarPreview] = useState(user?.image || "");
    const [msg, setMsg] = useState({ ok: true, text: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!accessToken) return;
        apiRequest("/profile", { token: accessToken })
            .then((data) => {
                if (data.bio) setBio(data.bio);
            })
            .catch(() => {});
    }, [accessToken]);

    function handleAvatarFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target.result);
        reader.readAsDataURL(file);
    }

    async function saveProfile(e) {
        e.preventDefault();
        if (!accessToken) return;
        setLoading(true);
        setMsg({ ok: true, text: "" });
        try {
            await apiRequest("/profile", {
                method: "PATCH",
                token: accessToken,
                body: { name, bio, ...(avatarPreview && avatarPreview !== user?.image ? { avatarUrl: avatarPreview } : {}) },
            });
            await update({ name });
            setMsg({ ok: true, text: t("profile.saved") });
            addToast(t("profile.saved"), "success");
        } catch (err) {
            setMsg({ ok: false, text: err.message });
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 shrink-0">
                        {avatarPreview ? (
                            <Image src={avatarPreview} alt={name} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                                {name?.[0]?.toUpperCase() || "U"}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => avatarRef.current?.click()}
                            className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-(--border) bg-(--bg-elevated) text-(--text-muted) hover:text-(--text-primary)"
                            aria-label={t("settings.profile.changeAvatar")}
                        >
                            <Camera className="h-3 w-3" />
                        </button>
                        <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarFile} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-xl font-semibold text-(--text-primary)">{name || user?.name}</h1>
                            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {t("profile.thisIsYou")}
                            </span>
                        </div>
                        <p className="truncate text-sm text-(--text-muted)">{user?.email}</p>
                    </div>
                </div>

                <form onSubmit={saveProfile} className="mt-5 space-y-4 max-w-2xl">
                    <div>
                        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-(--text-secondary)">
                            {t("profile.displayName")}
                        </label>
                        <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                        <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-(--text-secondary)">
                            {t("profile.bio")}
                        </label>
                        <textarea id="bio" rows={3} className={`${inputCls} resize-none`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bioPlaceholder")} />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-(--text-muted)">
                            {t("profile.accountSettingsHint")}{" "}
                            <Link href="/settings/profile" className="font-medium text-brand-600 hover:text-brand-700">
                                {t("profile.accountSettingsLink")}
                            </Link>
                        </p>
                        <button
                            type="submit"
                            disabled={loading || !isReady}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {t("profile.saveProfile")}
                        </button>
                    </div>
                    {msg.text && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</p>}
                </form>
            </section>

            <ProfileTeamRoles organizations={organizations} />
        </div>
    );
}