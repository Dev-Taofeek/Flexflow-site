"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Copy, KeyRound, Loader2, QrCode, ShieldCheck, ShieldOff } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { useStepUp } from "@/contexts/StepUpContext";
import { apiRequest } from "@/lib/api-client";
import { useI18n } from "@/i18n";

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

const inputCls = "w-full rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text-primary) focus:border-brand-500 focus:outline-none";

export function ProfileSettingsClient() {
    const { data: session, update } = useSession();
    const { accessToken } = useApp();
    const { addToast } = useToast();
    const { t } = useI18n();
    const { runWithStepUp } = useStepUp();

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
    const [disableArmed, setDisableArmed] = useState(false);
    const [disableCode, setDisableCode] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [recoveryRemaining, setRecoveryRemaining] = useState(null);
    const [recoveryBusy, setRecoveryBusy] = useState(false);

    useEffect(() => {
        if (!accessToken) return;
        apiRequest("/profile", { token: accessToken })
            .then((data) => {
                setTwoFA((s) => ({ ...s, enabled: data.twoFactorEnabled || false }));
                setRecoveryRemaining(typeof data.recoveryCodesRemaining === "number" ? data.recoveryCodesRemaining : null);
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
            setProfileMsg({ ok: true, text: t("settings.profile.profileSaved") });
            addToast(t("settings.profile.profileSaved"), "success");
        } catch (err) {
            setProfileMsg({ ok: false, text: err.message });
            addToast(err.message, "error");
        } finally {
            setProfileLoading(false);
        }
    }

async function changePassword(e) {
        e.preventDefault();
        const pwErrors = validatePassword(newPw);
        if (pwErrors.length) { setPwMsg({ ok: false, text: pwErrors[0] }); return; }
        setPwLoading(true);
        setPwMsg({ ok: true, text: "" });
        try {
            await runWithStepUp(({ code }) =>
                apiRequest("/profile/password", {
                    method: "PATCH",
                    token: accessToken,
                    headers: code ? { "x-2fa-code": code } : {},
                    body: { currentPassword: curPw, newPassword: newPw },
                }),
            );
            setCurPw(""); setNewPw("");
            setPwMsg({ ok: true, text: t("settings.profile.passwordUpdated") });
            addToast(t("settings.profile.passwordUpdated"), "success");
        } catch (err) {
            if (!err?.cancelled) {
                setPwMsg({ ok: false, text: err.message });
                addToast(err.message, "error");
            }
        } finally {
            setPwLoading(false);
        }
    }

    function validatePassword(pw) {
        const errors = [];
        if (pw.length < 8) errors.push(t("settings.profile.passwordMinLengthError"));
        else if (!/[A-Z]/.test(pw)) errors.push(t("settings.profile.passwordUppercaseError"));
        else if (!/[a-z]/.test(pw)) errors.push(t("settings.profile.passwordLowercaseError"));
        else if (!/[0-9]/.test(pw)) errors.push(t("settings.profile.passwordNumberError"));
        return errors;
    }

    async function setup2FA() {
        setTwoFA((s) => ({ ...s, loading: true, msg: { ok: true, text: "" } }));
        try {
            const data = await apiRequest("/profile/2fa/setup", { method: "POST", token: accessToken });
setTwoFA((s) => ({ ...s, loading: false, qrCode: data.qrCode, secret: data.secret }));
            addToast(t("settings.profile.scanQrToast"), "info");
        } catch (err) {
            setTwoFA((s) => ({ ...s, loading: false, msg: { ok: false, text: err.message } }));
            addToast(err.message, "error");
        }
    }

    async function verify2FA(e) {
        e.preventDefault();
        setTwoFA((s) => ({ ...s, loading: true }));
        try {
            const data = await apiRequest("/profile/2fa/verify", { method: "POST", token: accessToken, body: { code: twoFA.code } });
            setTwoFA((s) => ({ ...s, loading: false, enabled: true, qrCode: "", secret: "", code: "", msg: { ok: true, text: t("settings.profile.twoFactorEnabledStatus") } }));
            if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length) {
                setRecoveryCodes(data.recoveryCodes);
                setRecoveryRemaining(data.recoveryCodes.length);
            }
            addToast(t("settings.profile.twoFactorEnabledToast"), "success");
        } catch (err) {
            setTwoFA((s) => ({ ...s, loading: false, msg: { ok: false, text: err.message } }));
            addToast(err.message, "error");
        }
    }

    async function regenerateCodes() {
        setRecoveryBusy(true);
        try {
            const data = await runWithStepUp(({ code }) =>
                apiRequest("/profile/2fa/recovery-codes", {
                    method: "POST",
                    token: accessToken,
                    headers: code ? { "x-2fa-code": code } : {},
                }),
            );
            const codes = Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [];
            setRecoveryCodes(codes);
            setRecoveryRemaining(codes.length);
            addToast(t("settings.profile.recoveryCodesRegenerated"), "success");
        } catch (err) {
            if (!err?.cancelled) addToast(err.message, "error");
        } finally {
            setRecoveryBusy(false);
        }
    }

    async function copyRecoveryCodes() {
        try {
            await navigator.clipboard.writeText(recoveryCodes.join("\n"));
            addToast(t("settings.profile.recoveryCodesCopied"), "success");
        } catch {
            addToast(t("settings.profile.recoveryCodesCopied"), "error");
        }
    }

async function disable2FA(e) {
        e.preventDefault();
        if (disableCode.trim().length < 6) return;
        setTwoFA((s) => ({ ...s, loading: true }));
        try {
            await apiRequest("/profile/2fa", { method: "DELETE", token: accessToken, body: { code: disableCode.trim() } });
            setTwoFA((s) => ({ ...s, loading: false, enabled: false, msg: { ok: true, text: t("settings.profile.twoFactorDisabled") } }));
            setDisableArmed(false);
            setDisableCode("");
            setRecoveryCodes([]);
            setRecoveryRemaining(null);
            addToast(t("settings.profile.twoFactorDisabled"), "success");
        } catch (err) {
            setTwoFA((s) => ({ ...s, loading: false, msg: { ok: false, text: err.message } }));
            addToast(err.message, "error");
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Profile */}
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                <h2 className="text-base font-semibold text-(--text-primary)">{t("settings.profile.profileSectionTitle")}</h2>
                <form onSubmit={saveProfile} className="mt-5 space-y-4">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <div className="relative h-16 w-16 shrink-0">
                            {avatarPreview ? (
                                <Image src={avatarPreview} alt={name} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
                            ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
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
                                {t("settings.profile.changeAvatar")}
                            </button>
                            <p className="mt-1 text-xs text-(--text-muted)">{t("settings.profile.avatarHint")}</p>
                            <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarFile} />
                        </div>
                    </div>

                    <Field label={t("settings.profile.displayName")} id="name">
                        <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
                    </Field>
                    <Field label={t("settings.profile.bio")} id="bio">
                        <textarea id="bio" rows={3} className={`${inputCls} resize-none`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("settings.profile.bioPlaceholder")} />
                    </Field>
                    <Field label={t("settings.profile.email")} id="email">
                        <input id="email" className={`${inputCls} opacity-60`} value={user?.email || ""} readOnly />
                    </Field>

                    <StatusMsg ok={profileMsg.ok} msg={profileMsg.text} />
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={profileLoading}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                            {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {t("settings.profile.saveProfile")}
                        </button>
                    </div>
                </form>
            </section>

            {/* Password */}
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                <h2 className="text-base font-semibold text-(--text-primary)">{t("settings.profile.changePassword")}</h2>
                <form onSubmit={changePassword} className="mt-5 space-y-4">
                    <Field label={t("settings.profile.currentPassword")} id="cur-pw">
                        <input id="cur-pw" type="password" className={inputCls} value={curPw} onChange={(e) => setCurPw(e.target.value)} required />
                    </Field>
                    <Field label={t("settings.profile.newPassword")} id="new-pw">
                        <input id="new-pw" type="password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
                    </Field>
                    <StatusMsg ok={pwMsg.ok} msg={pwMsg.text} />
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={pwLoading}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                            {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {t("settings.profile.updatePassword")}
                        </button>
                    </div>
                </form>
            </section>

{/* 2FA */}
            <section className="rounded-xl border border-(--border) bg-(--bg-elevated) p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold text-(--text-primary)">
                            <ShieldCheck className="h-4 w-4 text-brand-600" />
                            {t("settings.profile.twoFactorAuth")}
                        </h2>
                        <p className="mt-1 text-sm text-(--text-muted)">
                            {t("settings.profile.twoFactorDescription")}
                        </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${twoFA.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {twoFA.enabled ? t("settings.profile.enabled") : t("settings.profile.off")}
                    </span>
                </div>

                <div className="mt-5">
                    {twoFA.enabled ? (
                        <div className="space-y-4">
                        {disableArmed ? (
                            <form onSubmit={disable2FA} className="flex flex-wrap items-center gap-2">
                                <input
                                    type="text"
                                    inputMode="text"
                                    autoComplete="one-time-code"
                                    maxLength={12}
                                    placeholder="000000"
                                    value={disableCode}
                                    onChange={(e) => setDisableCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                                    autoFocus
                                    className="w-40 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-center text-sm tracking-widest focus:border-brand-500 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={twoFA.loading || disableCode.trim().length < 6}
                                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {twoFA.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                                    {t("settings.profile.confirmDisable")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setDisableArmed(false); setDisableCode(""); }}
                                    className="rounded-lg border border-(--border) bg-(--bg) px-4 py-2 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-overlay) transition-colors"
                                >
                                    {t("settings.common.cancel")}
                                </button>
                                <p className="w-full text-xs text-(--text-muted)">
                                    {t("settings.profile.confirmDisableHint")}
                                </p>
                            </form>
                        ) : (
                            <button
                                onClick={() => setDisableArmed(true)}
                                disabled={twoFA.loading}
                                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ShieldOff className="h-4 w-4" /> {t("settings.profile.disable2FA")}
                            </button>
                        )}
                        <div className="rounded-xl border border-(--border) bg-(--bg) p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="flex items-center gap-1.5 text-sm font-medium text-(--text-primary)">
                                        <KeyRound className="h-4 w-4 text-(--text-muted)" />
                                        {t("settings.profile.recoveryCodesTitle")}
                                    </p>
                                    <p className="mt-0.5 text-xs text-(--text-muted)">
                                        {recoveryRemaining === null
                                            ? t("settings.profile.recoveryCodesDescription")
                                            : recoveryRemaining === 0
                                              ? t("settings.profile.recoveryCodesNone")
                                              : recoveryRemaining === 1
                                                ? t("settings.profile.recoveryCodesRemainingOne", { count: recoveryRemaining })
                                                : t("settings.profile.recoveryCodesRemaining", { count: recoveryRemaining })}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={regenerateCodes}
                                    disabled={recoveryBusy}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-1.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay) disabled:opacity-50"
                                >
                                    {recoveryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                    {t("settings.profile.regenerateRecoveryCodes")}
                                </button>
                            </div>
                            {recoveryCodes.length ? (
                                <div className="mt-3">
                                    <p className="text-xs font-medium text-amber-700">{t("settings.profile.saveRecoveryCodesHint")}</p>
                                    <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-(--bg-overlay) p-3 font-mono text-xs text-(--text-secondary)">
                                        {recoveryCodes.map((c) => (
                                            <span key={c}>{c}</span>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={copyRecoveryCodes}
                                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-500"
                                    >
                                        <Copy className="h-3 w-3" />
                                        {t("settings.profile.recoveryCodesCopy")}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        </div>
                    ) : twoFA.qrCode ? (
                        <div className="space-y-4">
                            <p className="text-sm text-(--text-secondary)">{t("settings.profile.scanQrHint")}</p>
                            <Image src={twoFA.qrCode} alt={t("settings.profile.qrAlt")} width={160} height={160} className="rounded-xl border border-(--border)" />
                            <p className="text-xs text-(--text-muted)">{t("settings.profile.manualKeyLabel")}: <code className="rounded bg-(--bg-overlay) px-1.5 py-0.5">{twoFA.secret}</code></p>
                            <form onSubmit={verify2FA} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={twoFA.code}
                                    onChange={(e) => setTwoFA((s) => ({ ...s, code: e.target.value.replace(/\D/g, "") }))}
                                    className="w-32 rounded-lg border border-(--border) bg-(--bg) px-3 py-2 text-center text-sm tracking-widest focus:border-brand-500 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={twoFA.loading || twoFA.code.length !== 6}
                                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                                >
                                    {t("settings.profile.verify")}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <button
                            onClick={setup2FA}
                            disabled={twoFA.loading}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {twoFA.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                            {t("settings.profile.setUp2FA")}
                        </button>
                    )}
                    <StatusMsg ok={twoFA.msg.ok} msg={twoFA.msg.text} />
                </div>
            </section>
        </div>
    );
}
