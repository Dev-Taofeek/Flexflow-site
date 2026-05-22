"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "info") => {
        const id = Date.now();
        setToasts((t) => [...t, { id, message, type }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }, []);

    const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
                {toasts.map((t) => (
                    <div key={t.id} className={[
                        "flex items-start gap-3 rounded-xl border p-3 shadow-lg text-sm",
                        t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                        t.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
                        "bg-(--bg-elevated) border-(--border) text-(--text-primary)",
                    ].join(" ")}>
                        {t.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" /> :
                         t.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" /> :
                         <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-500" />}
                        <span className="flex-1 leading-snug">{t.message}</span>
                        <button onClick={() => dismiss(t.id)} className="shrink-0 text-(--text-muted) hover:text-(--text-primary)">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside ToastProvider");
    return ctx;
}
