const supabase = require("../config/database");
const { sendSuccess, sendError, sendPaginated } = require("../utils/responseHelper");
const logger = require("../utils/logger");

function canManageIntegrations(user) {
  return !!user && ["super_admin", "admin", "manager"].includes(String(user.role || ""));
}

function maskIntegration(integration) {
  if (!integration) return integration;
  return {
    ...integration,
    auth_secret: integration.auth_secret ? "********" : null,
  };
}

function normalizeAuthType(value) {
  const v = String(value || "none").trim().toLowerCase();
  return ["none", "bearer", "api_key", "basic"].includes(v) ? v : "none";
}

function normalizeTargetSystem(value) {
  const v = String(value || "custom").trim().toLowerCase();
  return ["nerc", "nesrea", "custom"].includes(v) ? v : "custom";
}

function normalizeHeaders(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (!k || typeof v === "object") continue;
    out[String(k)] = String(v);
  }
  return out;
}

function getByPath(source, path) {
  if (!path) return undefined;
  const parts = String(path).split(".").filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function setByPath(target, path, value) {
  const parts = String(path).split(".").filter(Boolean);
  if (parts.length === 0) return;
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function normalizeFieldMappings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function buildMappedPayload(rawPayload, eventType, fieldMappings) {
  const allMappings = normalizeFieldMappings(fieldMappings);
  const template = allMappings[eventType];
  if (!template || typeof template !== "object" || Array.isArray(template)) return rawPayload;

  const output = {};
  for (const [targetKey, spec] of Object.entries(template)) {
    let resolved;
    if (typeof spec === "string") {
      resolved = getByPath(rawPayload, spec);
    } else if (spec && typeof spec === "object" && !Array.isArray(spec)) {
      const pathValue = Reflect.get(spec, "$path");
      const literalValue = Reflect.get(spec, "$literal");
      const nowValue = Reflect.get(spec, "$now");
      const valueValue = Reflect.get(spec, "$value");
      if (pathValue) resolved = getByPath(rawPayload, pathValue);
      else if (Object.prototype.hasOwnProperty.call(spec, "$literal")) resolved = literalValue;
      else if (nowValue === true) resolved = new Date().toISOString();
      else if (valueValue !== undefined) resolved = valueValue;
    } else {
      resolved = spec;
    }
    if (resolved !== undefined) setByPath(output, targetKey, resolved);
  }

  return output;
}

function withAuthHeaders(integration) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...normalizeHeaders(integration.default_headers),
  };

  if (integration.auth_type === "bearer" && integration.auth_secret) {
    headers.authorization = `Bearer ${integration.auth_secret}`;
  } else if (integration.auth_type === "api_key" && integration.auth_secret) {
    headers[integration.auth_header_name || "x-api-key"] = integration.auth_secret;
  } else if (integration.auth_type === "basic" && integration.auth_secret) {
    const encoded = Buffer.from(`${integration.auth_username || ""}:${integration.auth_secret}`).toString("base64");
    headers.authorization = `Basic ${encoded}`;
  }

  return headers;
}

function maskedHeaders(headers) {
  const out: Record<string, string> = { ...headers };
  if (out.authorization) out.authorization = "[redacted]";
  const apiKeyHeader = Object.keys(out).find((k) => k.toLowerCase() === "x-api-key");
  if (apiKeyHeader) out[apiKeyHeader] = "[redacted]";
  return out;
}

function resolveDispatchMeta(integration, mode, customPath, payload) {
  const endpoints = integration.endpoints || {};
  const requestPath =
    mode === "project_registration"
      ? endpoints.project_registration_path || "/project-registrations"
      : mode === "compliance_report"
        ? endpoints.compliance_report_path || "/compliance-reports"
        : customPath || endpoints.custom_path || "/";

  const mappedPayload = buildMappedPayload(payload, mode, integration.field_mappings);
  const normalizedPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  const url = `${integration.base_url}${normalizedPath}`;
  const headers = withAuthHeaders(integration);

  return { requestPath: normalizedPath, mappedPayload, url, headers };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("request_timeout")), timeoutMs);
  });
  return Promise.race([fetch(url, options), timeoutPromise]);
}

async function logDispatch({
  integration,
  eventType,
  requestPath,
  requestPayload = null,
  responseStatus,
  responseBody,
  errorMessage,
  dispatchedBy,
}) {
  await supabase.from("external_integration_logs").insert({
    integration_id: integration.id,
    company_id: integration.company_id,
    event_type: eventType,
    request_path: requestPath,
    request_payload: requestPayload || null,
    response_status: responseStatus || null,
    response_body: responseBody || null,
    error_message: errorMessage || null,
    dispatched_by: dispatchedBy || null,
  });
}

function requireCompany(req, res) {
  if (!req.user?.company_id) {
    sendError(res, "No company is linked to this account", 400);
    return false;
  }
  if (!canManageIntegrations(req.user)) {
    sendError(res, "Only company admins/managers can manage integrations", 403);
    return false;
  }
  return true;
}

exports.listIntegrations = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const { data, error } = await supabase
      .from("external_integrations")
      .select("*")
      .eq("company_id", req.user.company_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return sendSuccess(res, (data || []).map(maskIntegration));
  } catch (error) {
    logger.error("listIntegrations failed", { message: error.message });
    return sendError(res, "Failed to list integrations", 500);
  }
};

exports.createIntegration = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const name = String(req.body?.name || "").trim();
    const baseUrl = String(req.body?.base_url || "").trim();
    if (!name || !baseUrl) return sendError(res, "name and base_url are required", 422);

    const payload = {
      company_id: req.user.company_id,
      created_by: req.supabaseUser?.id || req.user?.supabase_uid || null,
      name,
      target_system: normalizeTargetSystem(req.body?.target_system),
      base_url: baseUrl.replace(/\/$/, ""),
      auth_type: normalizeAuthType(req.body?.auth_type),
      auth_header_name: req.body?.auth_header_name ? String(req.body.auth_header_name).trim() : null,
      auth_secret: req.body?.auth_secret ? String(req.body.auth_secret).trim() : null,
      auth_username: req.body?.auth_username ? String(req.body.auth_username).trim() : null,
      default_headers: normalizeHeaders(req.body?.default_headers),
      endpoints: req.body?.endpoints && typeof req.body.endpoints === "object" ? req.body.endpoints : {},
      field_mappings: normalizeFieldMappings(req.body?.field_mappings),
      timeout_ms: Math.max(1000, Math.min(60000, Number(req.body?.timeout_ms) || 15000)),
      is_active: req.body?.is_active !== false,
    };

    const { data, error } = await supabase
      .from("external_integrations")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return sendSuccess(res, maskIntegration(data), "Integration created", 201);
  } catch (error) {
    logger.error("createIntegration failed", { message: error.message });
    return sendError(res, "Failed to create integration", 500);
  }
};

exports.updateIntegration = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const { id } = req.params;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (req.body?.name !== undefined) updates.name = String(req.body.name || "").trim();
    if (req.body?.target_system !== undefined) updates.target_system = normalizeTargetSystem(req.body.target_system);
    if (req.body?.base_url !== undefined) updates.base_url = String(req.body.base_url || "").trim().replace(/\/$/, "");
    if (req.body?.auth_type !== undefined) updates.auth_type = normalizeAuthType(req.body.auth_type);
    if (req.body?.auth_header_name !== undefined) updates.auth_header_name = req.body.auth_header_name ? String(req.body.auth_header_name).trim() : null;
    if (req.body?.auth_secret !== undefined) updates.auth_secret = req.body.auth_secret ? String(req.body.auth_secret).trim() : null;
    if (req.body?.auth_username !== undefined) updates.auth_username = req.body.auth_username ? String(req.body.auth_username).trim() : null;
    if (req.body?.default_headers !== undefined) updates.default_headers = normalizeHeaders(req.body.default_headers);
    if (req.body?.endpoints !== undefined && typeof req.body.endpoints === "object") updates.endpoints = req.body.endpoints;
    if (req.body?.field_mappings !== undefined) updates.field_mappings = normalizeFieldMappings(req.body.field_mappings);
    if (req.body?.timeout_ms !== undefined) {
      updates.timeout_ms = Math.max(1000, Math.min(60000, Number(req.body.timeout_ms) || 15000));
    }
    if (req.body?.is_active !== undefined) updates.is_active = !!req.body.is_active;

    const { data, error } = await supabase
      .from("external_integrations")
      .update(updates)
      .eq("id", id)
      .eq("company_id", req.user.company_id)
      .select("*")
      .single();
    if (error || !data) return sendError(res, "Integration not found", 404);
    return sendSuccess(res, maskIntegration(data), "Integration updated");
  } catch (error) {
    logger.error("updateIntegration failed", { message: error.message });
    return sendError(res, "Failed to update integration", 500);
  }
};

exports.deleteIntegration = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const { id } = req.params;
    const { error } = await supabase
      .from("external_integrations")
      .delete()
      .eq("id", id)
      .eq("company_id", req.user.company_id);
    if (error) throw error;
    return sendSuccess(res, null, "Integration deleted");
  } catch (error) {
    logger.error("deleteIntegration failed", { message: error.message });
    return sendError(res, "Failed to delete integration", 500);
  }
};

exports.testIntegration = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const { id } = req.params;
    const { data: integration, error } = await supabase
      .from("external_integrations")
      .select("*")
      .eq("id", id)
      .eq("company_id", req.user.company_id)
      .single();
    if (error || !integration) return sendError(res, "Integration not found", 404);

    const timeoutMs = integration.timeout_ms || 15000;
    const headers = withAuthHeaders(integration);
    const url = `${integration.base_url}/health`;

    let statusCode = null;
    let responseBody = null;
    let errorMessage = null;
    try {
      const response: any = await fetchWithTimeout(url, { method: "GET", headers }, timeoutMs);
      statusCode = response.status;
      responseBody = await response.text();
    } catch (err) {
      errorMessage = err.message || "request_failed";
    }

    await supabase
      .from("external_integrations")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: errorMessage ? "failed" : statusCode >= 200 && statusCode < 400 ? "ok" : "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    await logDispatch({
      integration,
      eventType: "test_connection",
      requestPath: "/health",
      responseStatus: statusCode,
      responseBody,
      errorMessage,
      dispatchedBy: req.supabaseUser?.id || null,
    });

    if (errorMessage) return sendError(res, `Integration test failed: ${errorMessage}`, 502);
    return sendSuccess(res, { status: statusCode, body: responseBody }, "Integration test completed");
  } catch (error) {
    logger.error("testIntegration failed", { message: error.message });
    return sendError(res, "Failed to test integration", 500);
  }
};

exports.dispatchIntegration = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const { id } = req.params;
    const mode = String(req.body?.mode || "custom").trim();
    const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {};
    const customPath = req.body?.path ? String(req.body.path).trim() : "";

    const { data: integration, error } = await supabase
      .from("external_integrations")
      .select("*")
      .eq("id", id)
      .eq("company_id", req.user.company_id)
      .single();
    if (error || !integration) return sendError(res, "Integration not found", 404);
    if (!integration.is_active) return sendError(res, "Integration is inactive", 409);

    const { requestPath, mappedPayload, url, headers } = resolveDispatchMeta(
      integration,
      mode,
      customPath,
      payload
    );
    const timeoutMs = integration.timeout_ms || 15000;

    let statusCode = null;
    let responseBody = null;
    let errorMessage = null;
    try {
      const response: any = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(mappedPayload),
      }, timeoutMs);
      statusCode = response.status;
      responseBody = await response.text();
    } catch (err) {
      errorMessage = err.message || "dispatch_failed";
    }

    await logDispatch({
      integration,
      eventType: mode,
      requestPath,
      requestPayload: mappedPayload,
      responseStatus: statusCode,
      responseBody,
      errorMessage,
      dispatchedBy: req.supabaseUser?.id || null,
    });

    if (errorMessage) return sendError(res, `Dispatch failed: ${errorMessage}`, 502);
    return sendSuccess(res, { status: statusCode, body: responseBody }, "Dispatch completed");
  } catch (error) {
    logger.error("dispatchIntegration failed", { message: error.message });
    return sendError(res, "Failed to dispatch integration call", 500);
  }
};

exports.previewDispatch = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const { id } = req.params;
    const mode = String(req.body?.mode || "custom").trim();
    const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {};
    const customPath = req.body?.path ? String(req.body.path).trim() : "";

    const { data: integration, error } = await supabase
      .from("external_integrations")
      .select("*")
      .eq("id", id)
      .eq("company_id", req.user.company_id)
      .single();
    if (error || !integration) return sendError(res, "Integration not found", 404);

    const { mappedPayload, url, headers } = resolveDispatchMeta(integration, mode, customPath, payload);
    const bodyString = JSON.stringify(mappedPayload, null, 2);

    return sendSuccess(res, {
      raw_payload: payload,
      transformed_payload: mappedPayload,
      outbound_request: {
        method: "POST",
        url,
        headers: maskedHeaders(headers),
        body: mappedPayload,
        body_json: bodyString,
      },
    });
  } catch (error) {
    logger.error("previewDispatch failed", { message: error.message });
    return sendError(res, "Failed to preview dispatch payload", 500);
  }
};

exports.listIntegrationLogs = async (req, res) => {
  try {
    if (!requireCompany(req, res)) return;
    const integrationId = String(req.query.integration_id || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("external_integration_logs")
      .select("*", { count: "exact" })
      .eq("company_id", req.user.company_id)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (integrationId) query = query.eq("integration_id", integrationId);

    const { data, error, count } = await query;
    if (error) throw error;
    return sendPaginated(res, data || [], count || 0, page, limit, "Integration logs loaded");
  } catch (error) {
    logger.error("listIntegrationLogs failed", { message: error.message });
    return sendError(res, "Failed to list integration logs", 500);
  }
};
