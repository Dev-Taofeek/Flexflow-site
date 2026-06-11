"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { socket, setSocketToken } from "@/lib/socket";
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "@/lib/notifications-api";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
    const { accessToken } = useApp();
    const { addToast } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(() => {
        if (!accessToken) return;
        setLoading(true);
        fetchNotifications(accessToken)
            .then((d) => {
                setNotifications(d.notifications);
                setUnreadCount(d.unreadCount);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [accessToken]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // App-wide socket connection for real-time in-app notifications
    useEffect(() => {
        if (!accessToken) return;

        setSocketToken(accessToken);
        socket.connect();

        function onNew(notification) {
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((c) => c + 1);
            addToast(notification.title, "info");
        }

        socket.on("notification:new", onNew);
        return () => {
            socket.off("notification:new", onNew);
            socket.disconnect();
        };
    }, [accessToken, addToast]);

    const markRead = useCallback(async (id) => {
        await markNotificationRead(id, accessToken).catch(() => {});
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
    }, [accessToken]);

    const markAllRead = useCallback(async () => {
        await markAllNotificationsRead(accessToken).catch(() => {});
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
    }, [accessToken]);

    return (
        <NotificationsContext.Provider value={{ notifications, unreadCount, loading, refresh, markRead, markAllRead }}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
    return ctx;
}
