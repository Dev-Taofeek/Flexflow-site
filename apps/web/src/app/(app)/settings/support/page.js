"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LifeBuoy, Loader2, Send } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { useApp } from "@/contexts/AppContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n";

export default function SupportPage() {
    const searchParams = useSearchParams();
    const { currentOrg, accessToken } = useApp();
    const { can } = useEntitlements();
    const { addToast } = useToast();
    const { t } = useI18n();

    const orgId = searchParams.get("orgId") || currentOrg?.id;
    const hasAccess = can("dedicated_support");

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!orgId || !accessToken || !hasAccess) return;
        let cancelled = false;
        apiRequest("/support", { token: accessToken, params: { organizationId: orgId }, toast: false })
            .then((data) => {
                if (cancelled) return;
                setTickets(data.tickets);
            })
            .catch((err) => {
                if (cancelled || err?.code === "PLAN_REQUIRED") return;
                setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [orgId, accessToken, hasAccess]);

    async function submit(event) {
        event.preventDefault();
        if (!orgId || !accessToken || sending || !subject.trim() || !message.trim()) return;
        setSending(true);
        try {
            const { ticket } = await apiRequest("/support", {
                token: accessToken,
                method: "POST",
                body: { organizationId: orgId, subject, message },
            });
            setTickets((prev) => [ticket, ...prev]);
            setSubject("");
            setMessage("");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setSending(false);
        }
    }

    const openTickets = tickets.filter((ticket) => ticket.status === "OPEN").length;

    return (
        <div className="space-y-6">
            <UpgradePrompt
                feature="dedicated_support"
                title={t("settings.support.upgradeTitle")}
                description={t("settings.support.upgradeDescription")}
            />

            {loading ? (
                <div className="h-80 animate-pulse rounded-3xl border border-(--border) bg-(--bg-elevated)" />
            ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            ) : (
                <>
                    <section className="rounded-3xl border border-(--border) p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-600">
                                <LifeBuoy className="h-5 w-5" strokeWidth={1.7} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.support.contactTitle")}</h2>
                                <p className="mt-1 text-sm text-(--text-muted)">{t("settings.support.contactDescription")}</p>
                            </div>
                        </div>

                        <form onSubmit={submit} className="mt-6 space-y-4">
                            <label className="block text-sm font-medium text-(--text-primary)">
                                {t("settings.support.subject")}
                                <input
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    maxLength={120}
                                    required
                                    className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                                />
                            </label>
                            <label className="block text-sm font-medium text-(--text-primary)">
                                {t("settings.support.message")}
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    maxLength={4000}
                                    required
                                    className="border-border bg-background dark:border-border-dark dark:bg-background-dark mt-1.5 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40"
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={sending || !subject.trim() || !message.trim()}
                                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                            >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {t("settings.support.sendTicket")}
                            </button>
                        </form>
                    </section>

                    <section className="rounded-3xl border border-(--border) p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-(--text-primary)">{t("settings.support.historyTitle")}</h2>
                                <p className="mt-1 text-sm text-(--text-muted)">
                                    {t("settings.support.historyCount", { open: openTickets, total: tickets.length })}
                                </p>
                            </div>
                            <span className="rounded-full border border-(--border) bg-(--bg-overlay) px-3 py-1 text-xs font-medium text-(--text-secondary)">
                                {t("settings.support.slaPromise")}
                            </span>
                        </div>

                        {tickets.length === 0 ? (
                            <p className="mt-6 rounded-xl border border-dashed border-(--border) p-6 text-center text-sm text-(--text-muted)">
                                {t("settings.support.noTickets")}
                            </p>
                        ) : (
                            <ul className="divide-y divide-(--border) mt-4">
                                {tickets.map((ticket) => (
                                    <li key={ticket.id} className="py-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <p className="text-sm font-medium text-(--text-primary)">{ticket.subject}</p>
                                            <span
                                                className={[
                                                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                    ticket.status === "OPEN"
                                                        ? "bg-warning-500/10 text-warning-600"
                                                        : "bg-success-500/10 text-success-600",
                                                ].join(" ")}
                                            >
                                                {ticket.status === "OPEN" ? t("settings.support.statusOpen") : t("settings.support.statusResolved")}
                                            </span>
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap text-sm text-(--text-secondary)">{ticket.message}</p>
                                        <p className="mt-2 text-xs text-(--text-muted)">
                                            {new Date(ticket.createdAt).toLocaleString()}
                                            {ticket.slaDueAt ? ` · ${t("settings.support.slaBy", { time: new Date(ticket.slaDueAt).toLocaleString() })}` : ""}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}