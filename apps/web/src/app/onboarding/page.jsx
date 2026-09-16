"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    ArrowLeft,
    Building2,
    Users,
    Check,
    CheckCircle2,
    ChevronRight,
    Command,
    KeyRound,
    Layers,
    Lock,
    PartyPopper,
    Rocket,
    Sparkles,
    Wand2,
    Zap,
} from "lucide-react";

import { ONBOARDING_BREAKDOWN, getFeatureInfo } from "@flexflow/plans";
import { apiUrl } from "@/lib/api-url";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/TextArea";
import { Translated, useTranslatedText } from "@/lib/translate";

const CREATE_STEPS = ["welcome", "create", "plan", "done"];

const TEAM_VIBES = [
    { label: "Product", workspace: "Product", icon: Layers, blurb: "Roadmaps and releases" },
    { label: "Engineering", workspace: "Engineering", icon: Command, blurb: "Sprints and code" },
    { label: "Marketing", workspace: "Marketing", icon: Sparkles, blurb: "Campaigns and content" },
    { label: "Design", workspace: "Design", icon: Wand2, blurb: "Mocks and handoff" },
];

const FALLBACK_FEATURES =
    "Projects and tasks";

const WELCOME_FEATURES = [
    { icon: Zap, label: "Setup takes about two minutes" },
    { icon: Lock, label: "No credit card required" },
    { icon: Users, label: "Invite teammates whenever you like" },
];

const EASE = [0.22, 1, 0.36, 1];

function Confetti({ count = 90 }) {
    const ref = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const colors = ["#6366f1", "#818cf8", "#a5b4fc", "#22c55e", "#f59e0b", "#f472b6"];
        const pieces = Array.from({ length: count }, () => ({
            x: 0.1 + Math.random() * 0.8,
            y: -0.1 - Math.random() * 0.25,
            w: 5 + Math.random() * 6,
            h: 8 + Math.random() * 8,
            vx: (Math.random() - 0.5) * 1.8,
            vy: 1.2 + Math.random() * 2.2,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.22,
            color: colors[Math.floor(Math.random() * colors.length)],
        }));

        let raf = null;
        const dpr = window.devicePixelRatio || 1;
        const resize = () => {
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = canvas.offsetHeight * dpr;
        };
        resize();
        window.addEventListener("resize", resize);

        const tick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(dpr, dpr);
            const cw = canvas.width / dpr;
            const ch = canvas.height / dpr;
            let alive = false;
            for (const p of pieces) {
                p.x += p.vx / 100;
                p.y += p.vy / 100;
                p.vx += (Math.random() - 0.5) * 0.02;
                p.vy += 0.004;
                p.rot += p.vr;
                if (p.y * ch > ch + 20) continue;
                alive = true;
                ctx.save();
                ctx.translate(p.x * cw, p.y * ch);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, 1 - p.y * 1.1);
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
            ctx.restore();
            if (alive) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        const stop = setTimeout(() => cancelAnimationFrame(raf), 6000);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(stop);
            window.removeEventListener("resize", resize);
        };
    }, [count]);

    return (
        <canvas
            ref={ref}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-50 h-full w-full"
        />
    );
}

function StepDots({ current, total }) {
    return (
        <div className="flex items-center gap-2" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
                <motion.span
                    key={i}
                    animate={{
                        width: i === current ? 28 : 8,
                        backgroundColor:
                            i <= current ? "var(--color-brand-500)" : "var(--border-strong)",
                    }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="h-2 rounded-full"
                />
            ))}
        </div>
    );
}

function Eyebrow({ index, total, text }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <StepDots current={index} total={total} />
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                <Translated>Step</Translated> {index + 1} <Translated>of</Translated> {total}
            </p>
            {text ? (
                <p className="text-muted-foreground hidden text-xs sm:block">— <Translated>{text}</Translated></p>
            ) : null}
        </div>
    );
}

function wordy(text, delay = 0.04) {
    return text.split(" ").map((w, i, arr) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
            <motion.span
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: delay * i }}
                className="inline-block"
            >
                {w}
                {i < arr.length - 1 ? "\u00A0" : ""}
            </motion.span>
        </span>
    ));
}

export default function OnboardingPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const { refreshOrganizations, selectOrganization } = useApp();
    const { data: session } = useSession();
    const [step, setStep] = useState("welcome");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [created, setCreated] = useState(null);
    const [celebrate, setCelebrate] = useState(false);

    const [createForm, setCreateForm] = useState({
        name: "",
        workspaceName: "General",
        description: "",
    });
    const [joinForm, setJoinForm] = useState({ inviteCode: "" });

    const token = session?.user?.accessToken;
    const firstName = session?.user?.name?.split(" ")[0] || "there";
    const heroText = useTranslatedText("Make work feel light again.");

    const stepIndex = CREATE_STEPS.indexOf(step);

    const go = (next) => setStep(next);

    async function selectInto(org) {
        await refreshOrganizations();
        selectOrganization(org?.id, org?.workspaces?.[0]?.id || null);
    }

    async function handleCreate(e) {
        e.preventDefault();
        if (!createForm.name.trim()) {
            setError("Organization name is required");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const res = await fetch(apiUrl("/organizations"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(createForm),
            });
            const json = await res.json();
            if (!res.ok || !json.success)
                throw new Error(json.error?.message || "Failed to create organization");

            const org = json.organization || json.data || {};
            await selectInto(org);
            addToast("Organization created.", "success");
            setCreated(org);
            setCelebrate(true);
            go("plan");
        } catch (err) {
            setError(err.message);
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    }

    async function handleJoin(e) {
        e.preventDefault();
        if (!joinForm.inviteCode.trim()) {
            setError("Invite code or token is required");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const body =
                joinForm.inviteCode.length > 30
                    ? { token: joinForm.inviteCode }
                    : { inviteCode: joinForm.inviteCode };

            const res = await fetch(apiUrl("/organizations/join"), {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok || !json.success)
                throw new Error(json.error?.message || "Failed to join organization");

            await selectInto(json.data || null);
            addToast("Organization joined.", "success");
            setCelebrate(true);
            go("done");
        } catch (err) {
            setError(err.message);
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    }

    const labelClass = "text-foreground mb-1.5 block text-sm font-medium";
    const hintClass = "text-muted-foreground mt-1.5 text-xs";

    const variants = {
        enter: (dir) => ({ opacity: 0, x: dir * 40, scale: 0.98 }),
        center: { opacity: 1, x: 0, scale: 1 },
        exit: (dir) => ({ opacity: 0, x: dir * -40, scale: 0.98 }),
    };

    return (
        <div className="bg-background relative flex min-h-svh flex-col overflow-hidden">
            {celebrate ? <Confetti /> : null}

            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <motion.div
                    animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
                    transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                    className="bg-brand-600/10 absolute top-[-10%] right-[-8%] h-104 w-104 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{ x: [0, -30, 20, 0], y: [0, 25, -25, 0] }}
                    transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
                    className="bg-brand-400/5 absolute bottom-[-12%] left-[-10%] h-120 w-120 rounded-full blur-3xl"
                />
            </div>

            <header className="relative z-10 flex h-16 items-center justify-between px-6 sm:px-10">
                <div className="flex items-center gap-2.5">
                    <div className="bg-brand-600 flex h-8 w-8 items-center justify-center rounded-lg shadow-sm">
                        <span className="text-sm font-bold text-white">F</span>
                    </div>
                    <span className="text-foreground text-[15px] font-semibold tracking-tight">
                        FlexFlow
                    </span>
                </div>
                {stepIndex > 0 && step !== "done" ? (
                    <button
                        onClick={() => {
                            setError("");
                            go(CREATE_STEPS[stepIndex - 1]);
                        }}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" /> <Translated>Back</Translated>
                    </button>
                ) : (
                    <span className="text-muted-foreground text-sm">
                        <Translated>~2 minute setup</Translated>
                    </span>
                )}
            </header>

            <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6">
                <div className="w-full max-w-xl">
                    <AnimatePresence mode="wait" initial={false} custom={1}>
                        {step === "welcome" ? (
                            <motion.div
                                key="welcome"
                                custom={1}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.28, ease: EASE }}
                                className="text-center"
                            >
                                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium shadow-sm">
                                    <Rocket className="text-brand-500 h-3.5 w-3.5" />
                                    <span className="text-muted-foreground">
                                        <Translated>You&apos;re moments from your first workspace</Translated>
                                    </span>
                                </div>

                                <h1 className="text-foreground mx-auto max-w-lg text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
                                    {wordy(heroText)}
                                </h1>

                                <p className="text-muted-foreground mx-auto mt-4 max-w-md text-base leading-relaxed">
                                    <Translated>FlexFlow is where projects take shape, decisions stick, and</Translated>
                                    {` `}
                                    <span className="text-foreground font-medium">
                                        <Translated>your team actually knows what&apos;s next.</Translated>
                                    </span>
                                </p>

                                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                    <Button
                                        size="lg"
                                        className="w-full sm:w-auto"
                                        onClick={() => go("create")}
                                    >
                                        <Building2 className="h-4 w-4" />
                                        <Translated>Create my organization</Translated>
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="lg"
                                        variant="secondary"
                                        className="w-full sm:w-auto"
                                        onClick={() => go("join")}
                                    >
                                        <KeyRound className="h-4 w-4" />
                                        <Translated>I have an invite</Translated>
                                    </Button>
                                </div>

                                <div className="mx-auto mt-10 grid max-w-md gap-2.5 text-left sm:grid-cols-1">
                                    <motion.ul
                                        initial="hidden"
                                        animate="show"
                                        variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.4 } } }}
                                        className="space-y-2"
                                    >
                                        {WELCOME_FEATURES.map(({ icon: Icon, label }) => (
                                            <motion.li
                                                key={label}
                                                variants={{
                                                    hidden: { opacity: 0, y: 8 },
                                                    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
                                                }}
                                                className="flex items-center gap-2.5"
                                            >
                                                <span className="bg-success-500/10 text-success-600 flex h-5 w-5 items-center justify-center rounded-full">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                                <span className="text-muted-foreground text-sm"><Translated>{label}</Translated></span>
                                            </motion.li>
                                        ))}
                                    </motion.ul>
                                </div>
                            </motion.div>
                        ) : step === "create" ? (
                            <motion.div
                                key="create"
                                custom={1}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.28, ease: EASE }}
                            >
                                <Eyebrow index={1} total={4} text="Name the place your team calls home" />

                                <div className="mb-6">
                                    <div className="bg-brand-600/10 text-brand-600 flex h-11 w-11 items-center justify-center rounded-xl">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight">
                                        <Translated>Let&apos;s stand up your organization</Translated>
                                    </h2>
                                    <p className="text-muted-foreground mt-1.5 text-sm">
                                        <Translated>A few details now — you can always rename things later in settings. Everything below is changeable.</Translated>
                                    </p>
                                </div>

                                <form onSubmit={handleCreate} className="space-y-5">
                                    <div>
                                        <label className={labelClass}>
                                            <Translated>Organization name</Translated> <span className="text-danger-500">*</span>
                                        </label>
                                        <Input
                                            type="text"
                                            placeholder="Acme Corp"
                                            autoFocus
                                            value={createForm.name}
                                            onChange={(e) =>
                                                setCreateForm((f) => ({ ...f, name: e.target.value }))
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}><Translated>What does your team do?</Translated></label>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            {TEAM_VIBES.map(({ label, workspace, icon: Icon, blurb }) => {
                                                const active = createForm.workspaceName === workspace;
                                                return (
                                                    <button
                                                        key={label}
                                                        type="button"
                                                        onClick={() =>
                                                            setCreateForm((f) => ({
                                                                ...f,
                                                                workspaceName: workspace,
                                                            }))
                                                        }
                                                        className={`border-border bg-surface flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:outline-none ${
                                                            active
                                                                ? "border-brand-500 ring-brand-500/30 shadow-md ring-2 dark:border-brand-400"
                                                                : "hover:border-border-strong hover:shadow-sm"
                                                        }`}
                                                    >
                                                        <Icon
                                                            className={
                                                                active
                                                                    ? "text-brand-500 h-4 w-4"
                                                                    : "text-muted-foreground h-4 w-4"
                                                            }
                                                        />
                                                        <span className="text-foreground text-xs font-medium">
                                                            <Translated>{label}</Translated>
                                                            </span>
                                                        <span className="text-muted-foreground text-[11px] leading-tight">
                                                            <Translated>{blurb}</Translated>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-3">
                                            <label className={labelClass}><Translated>First workspace name</Translated></label>
                                            <Input
                                                type="text"
                                                placeholder="General"
                                                value={createForm.workspaceName}
                                                onChange={(e) =>
                                                    setCreateForm((f) => ({
                                                        ...f,
                                                        workspaceName: e.target.value,
                                                    }))
                                                }
                                            />
                                            <p className={hintClass}>
                                                <Translated>Workspaces group projects and people — you can add more anytime.</Translated>
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            <Translated>Description</Translated>{" "}
                                            <span className="text-muted-foreground font-normal">
                                                (<Translated>optional</Translated>)
                                            </span>
                                        </label>
                                        <Textarea
                                            placeholder="What does your team work on?"
                                            rows={2}
                                            value={createForm.description}
                                            onChange={(e) =>
                                                setCreateForm((f) => ({
                                                    ...f,
                                                    description: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    {error && <p className="text-danger-500 text-sm"><Translated>{error}</Translated></p>}

                                    <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                                        <PartyPopper className="h-4 w-4" />
                                        <Translated>Create</Translated> {createForm.name.trim() || <Translated>my organization</Translated>}
                                    </Button>
                                </form>
                            </motion.div>
                        ) : step === "plan" ? (
                            <motion.div
                                key="plan"
                                custom={1}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.28, ease: EASE }}
                            >
                                <Eyebrow index={2} total={4} text="Your Free plan, unpacked" />

                                <div className="mb-6 flex items-start gap-4">
                                    <div className="bg-brand-600/10 text-brand-600 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-foreground text-2xl font-bold tracking-tight">
                                            {created?.name || <Translated>Your organization</Translated>} <Translated>is live.</Translated>
                                        </h2>
                                        <p className="text-muted-foreground mt-1.5 text-sm">
                                            <Translated>You picked the</Translated> <span className="text-foreground font-medium"><Translated>Free plan</Translated></span> <Translated>— everything below is included, with room to grow when your team does.</Translated>
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="border-border bg-surface rounded-2xl border p-5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <p className="text-foreground text-sm font-semibold">
                                                <Translated>Included with Free</Translated>
                                            </p>
                                            <span className="bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                                                <Translated>$0 forever</Translated>
                                            </span>
                                        </div>
                                        <ul className="mt-3 space-y-2">
                                            {(ONBOARDING_BREAKDOWN.free?.length
                                                ? ONBOARDING_BREAKDOWN.free
                                                : []
                                            ).map((id) => {
                                                const info = getFeatureInfo(id);
                                                return (
                                                    <li
                                                        key={id}
                                                        className="text-muted-foreground flex items-center gap-2.5 text-sm"
                                                    >
                                                        <span className="bg-success-500/10 text-success-600 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                                                            <Check className="h-3 w-3" />
                                                        </span>
                                                        <Translated>{info?.name || id}</Translated>
                                                    </li>
                                                );
                                            })}
                                            {(ONBOARDING_BREAKDOWN.free?.length ? [] : [FALLBACK_FEATURES]).map(
                                                (name) => (
                                                    <li
                                                        key={name}
                                                        className="text-muted-foreground flex items-center gap-2.5 text-sm"
                                                    >
                                                        <span className="bg-success-500/10 text-success-600 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                                                            <Check className="h-3 w-3" />
                                                        </span>
                                                        <Translated>{name}</Translated>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>

                                    <div className="border-border bg-surface rounded-2xl border p-5 shadow-sm">
                                        <p className="text-foreground text-sm font-semibold">
                                            <Translated>Unlock more as you grow</Translated>
                                        </p>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {["pro", "custom"].map((tier) => (
                                                <div
                                                    key={tier}
                                                    className="border-border rounded-xl border p-3"
                                                >
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                                                        {tier === "custom" ? (
                                                            <Lock className="text-brand-500 h-3.5 w-3.5" />
                                                        ) : (
                                                            <Sparkles className="text-brand-500 h-3.5 w-3.5" />
                                                        )}
                                                        <span className="text-foreground">
                                                            {tier === "pro" ? <Translated>Pro</Translated> : <Translated>Custom</Translated>}
                                                        </span>
                                                    </div>
                                                    <ul className="mt-2 space-y-1.5">
                                                        {(ONBOARDING_BREAKDOWN[tier] || []).map((id) => (
                                                            <li
                                                                key={id}
                                                                className="text-muted-foreground flex items-center gap-2 text-xs"
                                                            >
                                                                <span className="text-brand-500 h-3.5 w-3.5 shrink-0">•</span>
                                                                <Translated>{getFeatureInfo(id)?.name || id}</Translated>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-muted-foreground mt-3 text-xs">
                                            <Translated>Upgrade anytime from Billing &amp; Plans in your settings. Entitlements activate immediately after checkout.</Translated>
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col gap-2">
                                    <Button
                                        size="lg"
                                        className="w-full"
                                        onClick={() => {
                                            setCelebrate(true);
                                            go("done");
                                        }}
                                    >
                                        <Translated>Everything looks right</Translated>
                                        <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Link
                                        href="/pricing"
                                        className="text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 inline-flex items-center justify-center gap-1 text-sm font-medium transition-colors"
                                    >
                                        <Translated>Compare all plans</Translated> <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            </motion.div>
                        ) : step === "done" ? (
                            <motion.div
                                key="done"
                                custom={1}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.28, ease: EASE }}
                                className="pb-6 text-center"
                            >
                                <motion.div
                                    initial={{ scale: 0, rotate: -20 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                                    className="bg-success-500/10 text-success-600 mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-sm"
                                >
                                    <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
                                </motion.div>

                                <h2 className="text-foreground mt-6 text-3xl font-bold tracking-tight">
                                    <Translated>You&apos;re all set,</Translated> {firstName}.
                                </h2>
                                <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed">
                                    {created?.name || <Translated>Your organization</Translated>}{" "}
                                    <Translated>is ready. Here&apos;s a quick peek at what waiting for you:</Translated>
                                </p>

                                <div className="mx-auto mt-6 grid max-w-sm gap-2.5 text-left">
                                    {[
                                        { icon: Layers, label: "Projects you can shape with boards and tasks" },
                                        { icon: Users, label: "A team you can invite with a single link" },
                                        { icon: Zap, label: "Decisions captured so nothing gets forgotten" },
                                    ].map(({ icon: Icon, label }, i) => (
                                        <motion.div
                                            key={label}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 + i * 0.12, duration: 0.35, ease: EASE }}
                                            className="border-border bg-surface flex items-center gap-3 rounded-xl border p-3.5 shadow-sm"
                                        >
                                            <span className="bg-brand-600/10 text-brand-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <span className="text-foreground text-sm"><Translated>{label}</Translated></span>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="mx-auto mt-8 max-w-sm">
                                    <Button
                                        size="lg"
                                        className="w-full"
                                        onClick={() => router.push("/dashboard")}
                                    >
                                        <Rocket className="h-4 w-4" />
                                        <Translated>Enter</Translated> {created?.name || <Translated>your organization</Translated>}
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="join"
                                custom={1}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.28, ease: EASE }}
                            >
                                <button
                                    onClick={() => {
                                        setError("");
                                        go("welcome");
                                    }}
                                    className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1.5 text-sm transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" /> <Translated>Back</Translated>
                                </button>

                                <div className="mb-6">
                                    <div className="bg-brand-600/10 text-brand-600 flex h-11 w-11 items-center justify-center rounded-xl">
                                        <KeyRound className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight">
                                        <Translated>Join your team</Translated>
                                    </h2>
                                    <p className="text-muted-foreground mt-1.5 text-sm">
                                        <Translated>Paste the invite code your admin shared, or the full invite link token — both work.</Translated>
                                    </p>
                                </div>

                                <form onSubmit={handleJoin} className="space-y-5">
                                    <div>
                                        <label className={labelClass}>
                                            <Translated>Invite code or token</Translated>{" "}
                                            <span className="text-danger-500">*</span>
                                        </label>
                                        <Input
                                            type="text"
                                            placeholder="Paste code or full invite token"
                                            autoFocus
                                            className="font-mono"
                                            value={joinForm.inviteCode}
                                            onChange={(e) =>
                                                setJoinForm({ inviteCode: e.target.value })
                                            }
                                        />
                                        <p className={hintClass}>
                                            <Translated>Ask your organization admin for the invite code.</Translated>
                                        </p>
                                    </div>

                                    {error && <p className="text-danger-500 text-sm"><Translated>{error}</Translated></p>}

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        size="lg"
                                        isLoading={loading}
                                    >
                                        <ArrowRight className="h-4 w-4" />
                                        <Translated>Join organization</Translated>
                                    </Button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}