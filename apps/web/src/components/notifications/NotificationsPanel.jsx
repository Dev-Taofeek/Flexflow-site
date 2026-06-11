"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, Info, MessageSquare, Shield, UserPlus } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const TYPE_ICON = {
  INVITE: UserPlus,
  ISSUE_ASSIGNED: Shield,
  COMMENT: MessageSquare,
  SYSTEM: Bell,
  INFO: Info,
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsPanel({ open, onClose }) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const { permission, subscribe } = usePushSubscription();
  const ref = useRef(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  async function handleMarkRead(id) {
    if (!id) return;
    await markRead(id);
  }

  async function handleMarkAll() {
    await markAllRead();
  }

  if (!open) return null;

  const visibleNotifications = showAll ? notifications : notifications.slice(0, 6);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 z-50 mt-2 w-80 rounded-2xl border border-(--border) bg-(--bg-elevated) shadow-xl sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-(--border) px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-(--text-primary)" />
          <span className="text-sm font-semibold text-(--text-primary)">Notifications</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {permission === "default" && (
            <button
              onClick={subscribe}
              className="text-xs text-indigo-600 hover:text-indigo-500"
            >
              Enable push
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="max-h-105 overflow-y-auto">
        {loading && (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-(--border)" />
            ))}
          </div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-8 w-8 text-(--text-muted)" />
            <p className="mt-2 text-sm font-medium text-(--text-primary)">All caught up</p>
            <p className="text-xs text-(--text-muted)">No notifications yet</p>
          </div>
        )}
        {!loading &&
          visibleNotifications.map((n) => {
            const Icon = TYPE_ICON[n.type] || Info;
            return (
              <button
                key={n.id}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
                className={[
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-(--bg-overlay)",
                  !n.isRead ? "bg-indigo-50/40" : "",
                ].join(" ")}
              >
                <div
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    !n.isRead
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-(--bg-overlay) text-(--text-muted)",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "truncate text-sm",
                      !n.isRead ? "font-medium text-(--text-primary)" : "text-(--text-secondary)",
                    ].join(" ")}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-(--text-muted)">{n.message}</p>
                  <p className="mt-1 text-[10px] text-(--text-muted)">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
              </button>
            );
          })}
      </div>
      {!loading && notifications.length > 6 && (
        <div className="border-t border-(--border) p-2">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-(--bg-overlay)"
          >
            {showAll ? "Show recent 6" : `Show all (${notifications.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
