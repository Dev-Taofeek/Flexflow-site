import { apiRequest } from "./api-client";

export const fetchNotifications = (token) =>
    apiRequest("/notifications", { token });

export const markNotificationRead = (id, token) =>
    apiRequest(`/notifications/${id}/read`, { method: "PATCH", token });

export const markAllNotificationsRead = (token) =>
    apiRequest("/notifications/read-all", { method: "PATCH", token });

export const subscribeToPush = (subscription, token) =>
    apiRequest("/notifications/push-subscriptions", { method: "POST", token, body: subscription });

export const unsubscribeFromPush = (endpoint, token) =>
    apiRequest("/notifications/push-subscriptions", { method: "DELETE", token, body: { endpoint } });
