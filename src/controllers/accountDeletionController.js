const path = require("path");
const User = require("../models/User");
const AppUser = require("../models/AppUser");
const AccountDeletionRequest = require("../models/AccountDeletionRequest");
const { revokeAllUserSessions } = require("../services/refreshSessionService");
const errorResponse = require("../utils/errorResponse");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeReason(reason) {
  if (reason === undefined || reason === null) {
    return null;
  }
  const normalized = String(reason).trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 1000);
}

function parseConfirmation(value) {
  return value === true
    || value === "true"
    || value === "on"
    || value === "1"
    || value === 1;
}

function buildRequestMetadata(req, source) {
  return {
    source,
    ipAddress: req.ip || (req.connection && req.connection.remoteAddress) || null,
    userAgent: req.get ? req.get("user-agent") || null : null,
    requiresManualVerification: source === "public_form",
    processingNote: source === "authenticated_app"
      ? "Authenticated user was soft-deleted immediately; transactional records are retained for legal and operational integrity."
      : "Public request must be verified by operations before account data is changed.",
  };
}

async function softDeleteAuthenticatedUser({ userId, email, reason, req }) {
  const now = new Date();
  const user = await User.findOne({ _id: userId, role: "client" });
  if (!user) {
    return null;
  }

  const request = await AccountDeletionRequest.create({
    userId: user._id,
    email,
    reason,
    status: "completed",
    requestedAt: now,
    processedAt: now,
    metadata: buildRequestMetadata(req, "authenticated_app"),
  });

  user.isActive = false;
  user.passwordHash = null;
  user.fcmTokens = [];
  user.name = user.name ? "Deleted User" : user.name;
  await user.save();

  await Promise.all([
    AppUser.updateMany(
      { coreUserId: user._id },
      { $set: { fullName: "Deleted User", fcmTokens: [] } }
    ),
    revokeAllUserSessions(user._id),
  ]);

  return request;
}

async function createPublicDeletionRequest({ email, reason, req }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await AccountDeletionRequest.findOne({
    email,
    status: "pending",
    requestedAt: { $gte: since },
  }).sort({ requestedAt: -1 });
  if (existing) {
    return existing;
  }

  return AccountDeletionRequest.create({
    userId: null,
    email,
    reason,
    status: "pending",
    requestedAt: new Date(),
    processedAt: null,
    metadata: buildRequestMetadata(req, "public_form"),
  });
}

function getAccountDeletionPage(_req, res) {
  return res.sendFile(path.join(__dirname, "../../public/account-deletion.html"));
}

async function requestAccountDeletion(req, res) {
  const body = req.body || {};
  const authenticatedEmail = req.authenticatedUser && req.authenticatedUser.email
    ? req.authenticatedUser.email
    : null;
  const email = normalizeEmail(body.email || authenticatedEmail);
  const reason = normalizeReason(body.reason);
  const confirmed = parseConfirmation(body.confirmation || body.confirmed || body.confirm);

  if (!email) {
    return errorResponse(res, 400, "INVALID_EMAIL", "email must be a valid email address");
  }
  if (!confirmed) {
    return errorResponse(res, 400, "CONFIRMATION_REQUIRED", "Deletion confirmation is required");
  }

  if (req.userId) {
    const request = await softDeleteAuthenticatedUser({
      userId: req.userId,
      email,
      reason,
      req,
    });
    if (!request) {
      return errorResponse(res, 401, "AUTH_REQUIRED", "Authentication required");
    }
    return res.status(200).json({
      ok: true,
      status: "completed",
      requestId: String(request._id),
      message: "Account deletion request completed. Active sessions have been revoked.",
    });
  }

  const request = await createPublicDeletionRequest({ email, reason, req });
  return res.status(202).json({
    ok: true,
    status: "pending",
    requestId: String(request._id),
    message: "Account deletion request received for manual verification.",
  });
}

module.exports = {
  getAccountDeletionPage,
  requestAccountDeletion,
  normalizeEmail,
};
