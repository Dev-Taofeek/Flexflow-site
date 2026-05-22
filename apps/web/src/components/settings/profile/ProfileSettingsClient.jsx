"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2, QrCode, ShieldCheck, ShieldOff } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { apiRequest } from "@/lib/api-client";
import { useRole } from "@/hooks/useRole";

function Field({ label, id, children }) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-(--text-secondary)">{label}</label>
            {children}
        </div>
    );
}

function StatusMsg({ ok, msg }) {
    if (!msg) return null;
    return (
        <p className={`mt-2 text-sm ${ok ? "text-emerald-600" : "text-red-500"}`}>{msg}</p>
    );
}

const inputCls = "w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-indigo-500 focus:outline-none";

export function ProfileSettingsClient() {
    const { data: session, update } = useSession();
    const { accessToken } = useApp();
    const { isOwner } = useRole();

    const user = session?.user;
    const avatarRef = useRef(null);

    const [name, setName] = useState(user?.name || "");
    const [bio, setBio] = useState("");
    const [avatarPreview, setAvatarPreview] = useState(user?.image || "");
    const [profileMsg, setProfileMsg] = useState({ ok: true, text: "" });
    const [profileLoading, setProfileLoading] = useState(false);

    const [curPw, setCurPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [pwMsg, setPwMsg] = useState({ ok: true, text: "" });
    const [pwLoading, setPwLoading] = useState(false);

    const [twoFA, setTwoFA] = useState({ enabled: false, qrCode: "", secret: "", code: "", loading: false, msg: { ok: true, text: "" } });

    useEffect(() => {
        if (!accessToken) return;
        apiRequest("/profile", { token: accessToken })
            .then((data) => {
                setTwoFA((s) => ({ ...s, enabled: data.twoFactorEnabled || false }));
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
        setProfileLoading(true);
        setProfileMsg({ ok: true, text: "" });
        try {
            await apiRequest("/profile", {
                method: "PATCH",
                token: accessToken,
                body: { name, bio, ...(avatarPreview && avatarPreview !== user?.image ? { avatarUrl: avatarPreview } : {}) },
            });
            await update({ name });
            setProfileMsg({ ok: true, text: "Profile saved." });
        } catch (err) {
            setProfileMsg({ ok: false, text: err.message });
        } finally {
            setProfileLoading(false);
        }
    }

    async function changePassword(e) {
        e.preventDefault();
        if (newPw.length < 8) { setPwMsg({ ok: false, text: "New password must be at least 8 characters." }); return; }
        setPwLoading(true);
        setPwMsg({ ok: true, text: "" });
        try {
            await apiRequest("/profile/password", { method: "PATCH", token: accessToken, body: { currentPassword: curPw, newPassword: newPw } });
            setCurPw(""); setNewPw("");
            setPwMsg({ ok: true, text: "Password updated." });
        } catch (err) {
            setPwMsg({ ok: false, text: err.message });
        } finally {
            setPwLoading(false);
        }
    }

    async function setup2FA() {
        setTwoFA((s) => ({ ...s, loading: true, msg: { ok: true, text: "" } }));
        try {
            const data = await apiRequest("/profile/2fa/setup", { method: "POST", token: accessToken });
            setTwoFA((s) => ({ ...s, loading: false, qrCode: data.qrCode, secret: data.secret }));
        } catch (err) {
            setTwoFA((s) => ({ ...s, loading: false, msg: { ok: false, text: err.message } }));
        }
    }

    async function verify2FA(e) {
        e.preventDefault();
        setTwoFA((s) => ({ ...s, loading: true }));
        try {
            await apiRequest("/profile/2fa/verify", { method: "POST", token: accessToken, body: { code: twoFA.code } });
            setTwoFA((s) => ({ ...s, loading: false, enabled: true, qrCode: "", secret: "", code: "", msg: { ok: true, text: "2FA enabled!" } }));
        } catch (err) {
            setTwoFA((s) => ({ ...s, loading: false, msg: { ok: false, text: err.message } }));
        }
    }

    async function disable2FA() {
        const code = prompt("Enter your current TOTP code to disable 2FA:");
        if (!code) return;
        setTwoFA((s) => ({ ...s, loading: true }));
        try {
            await apiRequest("/profile/2fa", { method: "DELETE", token: accessToken, body: { code } });
            setTwoFA((s) => ({ ...s, loading: false, enabled: false, msg: { ok: true, text: "2FA disabled." } }));
        } catch (err) {
            setTwoFA((s) => ({ ...s, loading: false, msg: { ok: false, text: err.message } }));
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Profile */}
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                <h2 className="text-base font-semibold text-(--text-primary)">Profile</h2>
                <form onSubmit={saveProfile} className="mt-5 space-y-4">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <div className="relative h-16 w-16 shrink-0">
                            {avatarPreview ? (
                                <Image src={avatarPreview} alt={name} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
                            ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
                                    {name?.[0]?.toUpperCase() || "U"}
                                </div>
                            )}
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={() => avatarRef.current?.click()}
                                className="rounded-lg border border-(--border) bg-(--bg) px-3 py-1.5 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-overlay) transition-colors"
                            >
                                Change avatar
                            </button>
                            <p className="mt-1 text-xs text-(--text-muted)">PNG, JPG, or WebP. Max 2MB.</p>
                            <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarFile} />
                        </div>
                    </div>

                    <Field label="Display name" id="name">
                        <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
                    </Field>
                    <Field label="Bio" id="bio">
                        <textarea id="bio" rows={3} className={`${inputCls} resize-none`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio about yourself" />
                    </Field>
                    <Field label="Email" id="email">
                        <input id="email" className={`${inputCls} opacity-60`} value={user?.email || ""} readOnly />
                    </Field>

                    <StatusMsg ok={profileMsg.ok} msg={profileMsg.text} />
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={profileLoading}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Save profile
                        </button>
                    </div>
                </form>
            </section>

            {/* Password */}
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                <h2 className="text-base font-semibold text-(--text-primary)">Change password</h2>
                <form onSubmit={changePassword} className="mt-5 space-y-4">
                    <Field label="Current password" id="cur-pw">
                        <input id="cur-pw" type="password" className={inputCls} value={curPw} onChange={(e) => setCurPw(e.target.value)} required />
                    </Field>
                    <Field label="New password" id="new-pw">
                        <input id="new-pw" type="password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
                    </Field>
                    <StatusMsg ok={pwMsg.ok} msg={pwMsg.text} />
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={pwLoading}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Update password
                        </button>
                    </div>
                </form>
            </section>

            {/* 2FA — owner only */}
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                {!isOwner && (
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Two-factor authentication can only be configured by the organization <strong>Owner</strong>.</span>
                    </div>
                )}

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold text-(--text-primary)">
                            <ShieldCheck className="h-4 w-4 text-indigo-600" />
                            Two-factor authentication
                        </h2>
                        <p className="mt-1 text-sm text-(--text-muted)">
                            Add an extra layer of security with a TOTP authenticator app (Google Authenticator, Authy, etc.)
                        </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${twoFA.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {twoFA.enabled ? "Enabled" : "Off"}
                    </span>
                </div>

                <div className="mt-5">
                    {twoFA.enabled ? (
                        <button
                            onClick={disable2FA}
                            disabled={twoFA.loading || !isOwner}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ShieldOff className="h-4 w-4" /> Disable 2FA
                        </button>
                    ) : twoFA.qrCode ? (
                        <div className="space-y-4">
                            <p className="text-sm text-(--text-secondary)">Scan this QR code with your authenticator app, then enter the 6-digit code below.</p>
                            <Image src={twoFA.qrCode} alt="2FA QR code" width={160} height={160} className="rounded-xl border border-(--border)" />
                            <p className="text-xs text-(--text-muted)">Manual key: <code className="rounded bg-(--bg-overlay) px-1.5 py-0.5">{twoFA.secret}</code></p>
                            <form onSubmit={verify2FA} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={twoFA.code}
                                    onChange={(e) => setTwoFA((s) => ({ ...s, code: e.target.value }))}
                                    className="w-32 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-center text-sm tracking-widest focus:border-indigo-500 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={twoFA.loading || twoFA.code.length !== 6}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                                >
                                    Verify
                                </button>
                            </form>
                        </div>
                    ) : (
                        <button
                            onClick={setup2FA}
                            disabled={twoFA.loading || !isOwner}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {twoFA.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                            Set up 2FA
                        </button>
                    )}
                    <StatusMsg ok={twoFA.msg.ok} msg={twoFA.msg.text} />
                </div>
            </section>
        </div>
    );
}
