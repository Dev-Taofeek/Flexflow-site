"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

const StepUpContext = createContext(null);

/**
 * Provides `runWithStepUp(executor)` to the app. The executor receives
 * `{ code }` and should attach it to the request (e.g. as an `x-2fa-code`
 * header). If the first attempt fails with a 2FA challenge, a modal collects a
 * fresh code and the executor is retried once.
 */
export function StepUpProvider({ children }) {
    const [pending, setPending] = useState(null);
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (pending && inputRef.current) inputRef.current.focus();
    }, [pending]);

    const runWithStepUp = useCallback(async (executor) => {
        try {
            return await executor({ code: undefined });
        } catch (err) {
            if (!err?.requiresTwoFactor) throw err;
        }

        const entered = await new Promise((resolve) => {
            setCode("");
            setError("");
            setPending(() => resolve);
        });

        if (!entered) {
            const cancelled = new Error("Two-factor verification cancelled.");
            cancelled.cancelled = true;
            throw cancelled;
        }
        return executor({ code: entered });
    }, []);

    const submit = () => {
        const value = code.trim();
        if (!value) {
            setError("Enter the 6-digit code from your authenticator app.");
            return;
        }
        setSubmitting(true);
        pending?.(value);
        setPending(null);
        setSubmitting(false);
    };

    return (
        <StepUpContext.Provider value={{ runWithStepUp }}>
            {children}
            {pending ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Two-factor verification"
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
                >
                    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
                        <h2 className="text-base font-semibold text-foreground">Confirm it&apos;s you</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Enter a fresh code from your authenticator app, or use one of your recovery codes.
                        </p>
                        <input
                            ref={inputRef}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submit()}
                            inputMode="text"
                            autoComplete="one-time-code"
                            placeholder="123456"
                            className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.3em] text-foreground focus:border-brand-500 focus:outline-none"
                        />
                        {error ? <p className="mt-2 text-sm text-danger-600">{error}</p> : null}
                        <div className="mt-5 flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    pending?.(null);
                                    setPending(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={submit} isLoading={submitting}>
                                Verify
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </StepUpContext.Provider>
    );
}

export function useStepUp() {
    const ctx = useContext(StepUpContext);
    if (!ctx) {
        // Safe fallback so components outside the provider still function.
        return { runWithStepUp: (executor) => executor({}) };
    }
    return ctx;
}
