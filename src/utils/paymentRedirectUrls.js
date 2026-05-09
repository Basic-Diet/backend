"use strict";

const HARD_FALLBACK_ORIGIN = "https://example.com";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isValidHttpsUrl(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

function getUrlScheme(value) {
  if (typeof value !== "string") return "none";
  const trimmed = value.trim();
  if (!trimmed) return "none";
  const match = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (match) return match[1].toLowerCase();
  try {
    const parsed = new URL(trimmed);
    return String(parsed.protocol || "").replace(/:$/, "").toLowerCase() || "unknown";
  } catch {
    return "invalid";
  }
}

function safeUrlForLog(value) {
  if (typeof value !== "string") return "none";
  try {
    const parsed = new URL(value.trim());
    return `${parsed.origin}${parsed.pathname || "/"}`;
  } catch {
    return "invalid_url";
  }
}

function getRequestOrigin(req) {
  if (!req || typeof req.get !== "function") return "";
  const host = String(req.get("host") || "").trim();
  if (!host) return "";
  const protocol = String(req.protocol || "").trim().toLowerCase();
  if (protocol === "https") return `https://${host}`;
  return "";
}

function resolveBackendOrigin({ req, appUrl } = {}) {
  const configured = String(appUrl || process.env.APP_URL || "").trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "https:") return parsed.origin;
    } catch {
      // Fall through to request-derived origin or hard fallback.
    }
  }

  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) return requestOrigin;

  if (isProduction()) return HARD_FALLBACK_ORIGIN;
  return HARD_FALLBACK_ORIGIN;
}

function normalizeOneRedirect(rawValue, fallbackUrl) {
  const originalScheme = getUrlScheme(rawValue);
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (isValidHttpsUrl(trimmed)) {
      return {
        url: trimmed,
        accepted: true,
        originalScheme,
        finalLogUrl: safeUrlForLog(trimmed),
      };
    }
  }

  return {
    url: fallbackUrl,
    accepted: false,
    originalScheme,
    finalLogUrl: safeUrlForLog(fallbackUrl),
  };
}

function normalizePaymentRedirectUrls({
  successUrl,
  backUrl,
  req,
  appUrl,
} = {}) {
  const origin = resolveBackendOrigin({ req, appUrl });
  const successFallback = `${origin}/payment-success`;
  const backFallback = `${origin}/payment-cancel`;
  const success = normalizeOneRedirect(successUrl, successFallback);
  const back = normalizeOneRedirect(backUrl, backFallback);

  return {
    backendOrigin: origin,
    successUrl: success.url,
    backUrl: back.url,
    logContext: {
      successRedirectAccepted: success.accepted,
      successOriginalScheme: success.originalScheme,
      successFinalUrl: success.finalLogUrl,
      backRedirectAccepted: back.accepted,
      backOriginalScheme: back.originalScheme,
      backFinalUrl: back.finalLogUrl,
    },
  };
}

module.exports = {
  normalizePaymentRedirectUrls,
  isValidHttpsUrl,
  getUrlScheme,
  safeUrlForLog,
};
