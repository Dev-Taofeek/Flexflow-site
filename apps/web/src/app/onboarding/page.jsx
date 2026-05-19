"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Users, ArrowRight, Check, ChevronLeft, Loader2, Sparkles } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function OnboardingPage() {
    const router = useRouter();
    const { data: session, update } = useSession();
    const [mode, setMode] = useState(null); // "create" | "join"
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [createForm, setCreateForm] = useState({ name: "", workspaceName: "General", description: "" });
    const [joinForm, setJoinForm] = useState({ inviteCode: "" });

    const token = session?.user?.accessToken;

    async function handleCreate(e) {
        e.preventDefault();
        if (!createForm.name.trim()) return setError("Organization name is required");
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/organizations`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(createForm),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to create organization");

            const org = json.data;
            await update({ onboarded: true, organizations: [...(session?.user?.organizations || []), org] });
            router.push("/dashboard");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleJoin(e) {
        e.preventDefault();
        if (!joinForm.inviteCode.trim()) return setError("Invite code or token is required");
        setError("");
        setLoading(true);
        try {
            const body = joinForm.inviteCode.length > 30
                ? { token: joinForm.inviteCode }
                : { inviteCode: joinForm.inviteCode };

            const res = await fetch(`${API_URL}/organizations/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to join organization");

            const org = json.data;
            await update({ onboarded: true, organizations: [...(session?.user?.organizations || []), org] });
            router.push("/dashboard");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#fafafa] flex flex-col">
            {/* Header */}
            <header className="flex h-16 items-center px-8 border-b border-[#e4e4e7] bg-white">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-[#18181b]">FlexFlow</span>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
                <div className="w-full max-w-lg">
                    <AnimatePresence mode="wait">
                        {!mode ? (
                            <motion.div
                                key="choice"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -16 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="text-center mb-10">
                                    <h1 className="text-2xl font-semibold text-[#18181b] mb-2">
                                        Welcome to FlexFlow{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
                                    </h1>
                                    <p className="text-[#71717a] text-sm">
                                        Get started by creating a new organization or joining an existing one.
                                    </p>
                                </div>

                                <div className="grid gap-4">
                                    <button
                                        onClick={() => setMode("create")}
                                        className="group relative flex items-start gap-4 rounded-xl border border-[#e4e4e7] bg-white p-6 text-left transition-all hover:border-indigo-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-[#18181b]">Create an organization</p>
                                                <ArrowRight className="h-4 w-4 text-[#a1a1aa] group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                            <p className="mt-1 text-sm text-[#71717a]">
                                                Set up a new organization and invite your team to collaborate.
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setMode("join")}
                                        className="group relative flex items-start gap-4 rounded-xl border border-[#e4e4e7] bg-white p-6 text-left transition-all hover:border-indigo-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 group-hover:bg-violet-100 transition-colors">
                                            <Users className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-[#18181b]">Join an organization</p>
                                                <ArrowRight className="h-4 w-4 text-[#a1a1aa] group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                            <p className="mt-1 text-sm text-[#71717a]">
                                                Enter an invite code or follow an invitation link from your team.
                                            </p>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        ) : mode === "create" ? (
                            <motion.div
                                key="create"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -16 }}
                                transition={{ duration: 0.2 }}
                            >
                                <button
                                    onClick={() => { setMode(null); setError(""); }}
                                    className="mb-8 flex items-center gap-1.5 text-sm text-[#71717a] hover:text-[#18181b] transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" /> Back
                                </button>

                                <div className="mb-8">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-4">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-[#18181b] mb-1">Create your organization</h2>
                                    <p className="text-sm text-[#71717a]">You can always change these details later in settings.</p>
                                </div>

                                <form onSubmit={handleCreate} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-[#18181b] mb-1.5">Organization name <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            placeholder="Acme Corp"
                                            value={createForm.name}
                                            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                                            className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[#18181b] mb-1.5">First workspace name</label>
                                        <input
                                            type="text"
                                            placeholder="General"
                                            value={createForm.workspaceName}
                                            onChange={(e) => setCreateForm((f) => ({ ...f, workspaceName: e.target.value }))}
                                            className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                        <p className="mt-1.5 text-xs text-[#a1a1aa]">You can add more workspaces after setup.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[#18181b] mb-1.5">Description <span className="text-[#a1a1aa] font-normal">(optional)</span></label>
                                        <textarea
                                            placeholder="What does your team work on?"
                                            rows={2}
                                            value={createForm.description}
                                            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                                            className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                        />
                                    </div>

                                    {error && <p className="text-sm text-red-500">{error}</p>}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Create organization
                                    </button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="join"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -16 }}
                                transition={{ duration: 0.2 }}
                            >
                                <button
                                    onClick={() => { setMode(null); setError(""); }}
                                    className="mb-8 flex items-center gap-1.5 text-sm text-[#71717a] hover:text-[#18181b] transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" /> Back
                                </button>

                                <div className="mb-8">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 mb-4">
                                        <Users className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-[#18181b] mb-1">Join an organization</h2>
                                    <p className="text-sm text-[#71717a]">Enter the invite code shared by your team or paste the invite link token.</p>
                                </div>

                                <form onSubmit={handleJoin} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-[#18181b] mb-1.5">Invite code or token <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            placeholder="Enter code or paste full invite token"
                                            value={joinForm.inviteCode}
                                            onChange={(e) => setJoinForm({ inviteCode: e.target.value })}
                                            className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                        />
                                        <p className="mt-1.5 text-xs text-[#a1a1aa]">Ask your organization admin for the invite code.</p>
                                    </div>

                                    {error && <p className="text-sm text-red-500">{error}</p>}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                        Join organization
                                    </button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
