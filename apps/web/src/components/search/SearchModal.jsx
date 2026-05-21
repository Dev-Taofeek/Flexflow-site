"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FolderKanban, Search, User2, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { searchAll } from "@/lib/search-api";

export function SearchModal({ open, onClose }) {
    const router = useRouter();
    const { currentWorkspaceId, accessToken } = useApp();
    const inputRef = useRef(null);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState({ issues: [], projects: [], members: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setQuery("");
            setResults({ issues: [], projects: [], members: [] });
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => {
        if (!query.trim() || query.length < 2) {
            setResults({ issues: [], projects: [], members: [] });
            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await searchAll({ q: query, workspaceId: currentWorkspaceId, token: accessToken });
                setResults(data);
            } catch {}
            finally { setLoading(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, currentWorkspaceId, accessToken]);

    function navigate(href) {
        router.push(href);
        onClose();
    }

    const hasResults = results.issues.length + results.projects.length + results.members.length > 0;

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-xl rounded-2xl border border-(--border) bg-(--bg-elevated) shadow-2xl">
                {/* Input */}
                <div className="flex items-center gap-3 border-b border-(--border) px-4 py-3">
                    <Search className="h-4 w-4 shrink-0 text-(--text-muted)" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search issues, projects, people…"
                        className="flex-1 bg-transparent text-sm text-(--text-primary) placeholder-(--text-muted) outline-none"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} className="text-(--text-muted) hover:text-(--text-secondary)">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                    <kbd className="hidden rounded border border-(--border) bg-(--bg-overlay) px-1.5 py-0.5 text-[10px] text-(--text-muted) sm:block">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-96 overflow-y-auto p-2">
                    {loading && (
                        <p className="px-3 py-6 text-center text-sm text-(--text-muted)">Searching…</p>
                    )}

                    {!loading && query.length >= 2 && !hasResults && (
                        <p className="px-3 py-6 text-center text-sm text-(--text-muted)">No results for &ldquo;{query}&rdquo;</p>
                    )}

                    {!loading && query.length < 2 && (
                        <p className="px-3 py-6 text-center text-sm text-(--text-muted)">Type at least 2 characters to search</p>
                    )}

                    {results.projects.length > 0 && (
                        <div className="mb-1">
                            <p className="px-3 py-1 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">Projects</p>
                            {results.projects.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => navigate(`/projects/${p.id}`)}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-(--bg-overlay)"
                                >
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: p.color || "#6366f1" }}>
                                        <FolderKanban className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <span className="text-(--text-primary)">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {results.issues.length > 0 && (
                        <div className="mb-1">
                            <p className="px-3 py-1 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">Issues</p>
                            {results.issues.map((i) => (
                                <button
                                    key={i.id}
                                    onClick={() => navigate(`/projects/${i.project.id}/issues/${i.id}`)}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-(--bg-overlay)"
                                >
                                    <FileText className="h-4 w-4 shrink-0 text-(--text-muted)" />
                                    <div className="min-w-0">
                                        <p className="truncate text-(--text-primary)">{i.title}</p>
                                        <p className="text-xs text-(--text-muted)">{i.project.name} · {i.status.replace(/_/g, " ")}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {results.members.length > 0 && (
                        <div className="mb-1">
                            <p className="px-3 py-1 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">People</p>
                            {results.members.map((m) => (
                                <div key={m.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                                        {m.name?.[0]?.toUpperCase() || <User2 className="h-3 w-3" />}
                                    </div>
                                    <div>
                                        <p className="text-(--text-primary)">{m.name}</p>
                                        <p className="text-xs text-(--text-muted)">{m.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
