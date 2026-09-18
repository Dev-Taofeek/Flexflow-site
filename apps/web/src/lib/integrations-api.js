import { apiRequest } from "./api-client";

export function fetchIntegrations(orgId, token) {
  return apiRequest("/integrations", { token, params: { orgId }, toast: false });
}

export function fetchIntegrationProviders(token) {
  return apiRequest("/integrations/providers", { token, toast: false });
}

export function startIntegrationOAuth(provider, orgId, token) {
  return apiRequest(`/integrations/oauth/${provider}/start`, { token, params: { orgId }, toast: false });
}

export function connectIntegration({ orgId, provider, token, webhookSecret, webhookSigningSecret, webhookPasscode, code }) {
  return apiRequest("/integrations", {
    method: "POST",
    token,
    headers: code ? { "x-2fa-code": code } : {},
    body: {
      orgId,
      provider,
      token,
      ...(webhookSecret ? { webhookSecret } : {}),
      ...(webhookSigningSecret ? { webhookSigningSecret } : {}),
      ...(webhookPasscode ? { webhookPasscode } : {}),
    },
  });
}

export function toggleIntegration(id, enabled, token) {
  return apiRequest(`/integrations/${id}`, {
    method: "PATCH",
    token,
    body: { enabled },
    successMessage: enabled ? "Integration enabled." : "Integration disabled.",
  });
}

export function testIntegration(id, token) {
  return apiRequest(`/integrations/${id}/test`, { method: "POST", token });
}

export function disconnectIntegration(id, token, code) {
  return apiRequest(`/integrations/${id}`, {
    method: "DELETE",
    token,
    headers: code ? { "x-2fa-code": code } : {},
    successMessage: "Integration disconnected.",
  });
}

export function fetchAutomations(orgId, workspaceId, token) {
  return apiRequest("/integrations/automations", {
    token,
    params: { orgId, workspaceId },
    toast: false,
  });
}

export function createAutomation({ organizationId, workspaceId, provider, trigger, action, actionConfig, token }) {
  return apiRequest("/integrations/automations", {
    method: "POST",
    token,
    body: { organizationId, workspaceId, provider, trigger, action, ...(actionConfig ? { actionConfig } : {}) },
    successMessage: "Automation rule created.",
  });
}

export function updateAutomation(id, { actionConfig, condition, enabled, trigger, workspaceId, token }) {
  return apiRequest(`/integrations/automations/${id}`, {
    method: "PATCH",
    token,
    body: {
      workspaceId,
      ...(trigger !== undefined ? { trigger } : {}),
      ...(condition !== undefined ? { condition } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(actionConfig !== undefined ? { actionConfig } : {}),
    },
    successMessage: "Automation rule updated.",
  });
}

export function deleteAutomation(id, workspaceId, token) {
  return apiRequest(`/integrations/automations/${id}`, {
    method: "DELETE",
    token,
    params: { workspaceId },
    successMessage: "Automation rule deleted.",
  });
}

export function fetchMappings(orgId, workspaceId, token) {
  return apiRequest("/integrations/mappings", {
    token,
    params: { orgId, workspaceId },
    toast: false,
  });
}

export function createMapping({ organizationId, workspaceId, provider, externalResourceType, externalResourceId, projectId, taskId, token }) {
  return apiRequest("/integrations/mappings", {
    method: "POST",
    token,
    body: {
      organizationId,
      workspaceId,
      provider,
      externalResourceType,
      externalResourceId,
      ...(projectId ? { projectId } : {}),
      ...(taskId ? { taskId } : {}),
    },
    successMessage: "Resource mapped.",
  });
}

export function deleteMapping(id, workspaceId, token) {
  return apiRequest(`/integrations/mappings/${id}`, {
    method: "DELETE",
    token,
    params: { workspaceId },
    successMessage: "Mapping removed.",
  });
}