import { apiRequest } from "./api-client";

export const updateProfile = (data, token) =>
    apiRequest("/profile", { method: "PATCH", body: data, token });

export const changePassword = (data, token) =>
    apiRequest("/profile/password", { method: "PATCH", body: data, token });

export const setup2FA = (token) =>
    apiRequest("/profile/2fa/setup", { method: "POST", token });

export const verify2FA = (code, token) =>
    apiRequest("/profile/2fa/verify", { method: "POST", body: { code }, token });

export const disable2FA = (code, token) =>
    apiRequest("/profile/2fa", { method: "DELETE", body: { code }, token });
