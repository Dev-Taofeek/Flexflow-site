"use client";

import { Crown, X } from "lucide-react";

export function PremiumModal({ open, onClose, feature, description }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-elevated) p-6 shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-1 text-(--text-muted) hover:bg-(--bg-overlay) hover:text-(--text-primary)"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                    <Crown className="h-6 w-6 text-amber-600" />
                </div>

                <h2 className="mt-4 text-lg font-semibold text-(--text-primary)">Premium Feature</h2>
                <p className="mt-0.5 text-sm font-medium text-amber-600">{feature}</p>
                <p className="mt-3 text-sm leading-relaxed text-(--text-muted)">{description}</p>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-(--border) px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-overlay)"
                    >
                        Maybe later
                    </button>
                    <button
                        className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                        onClick={onClose}
                    >
                        Upgrade to Premium
                    </button>
                </div>
            </div>
        </div>
    );
}
