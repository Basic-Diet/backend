const jwt = require("jsonwebtoken");

const DashboardUser = require("../models/DashboardUser");
const User = require("../models/User");
const errorResponse = require("../utils/errorResponse");
const { JWT_ACCESS_SECRET } = require("../services/appTokenService");
const { DASHBOARD_JWT_SECRET } = require("../services/dashboardTokenService");

const LEGACY_JWT_SECRET = process.env.JWT_SECRET;
const DASHBOARD_MENU_ROLES = new Set(["superadmin", "admin"]);

function verifyWithFallback(token, primarySecret) {
  try {
    return { decoded: jwt.verify(token, primarySecret) };
  } catch (err) {
    if (LEGACY_JWT_SECRET && LEGACY_JWT_SECRET !== primarySecret) {
      try {
        return { decoded: jwt.verify(token, LEGACY_JWT_SECRET) };
      } catch (legacyErr) {
        return { error: legacyErr && legacyErr.name === "TokenExpiredError" ? legacyErr : err };
      }
    }
    return { error: err };
  }
}

function tokenError(res, err) {
  if (err && err.name === "TokenExpiredError") {
    return errorResponse(res, 401, "TOKEN_EXPIRED", "Access token expired");
  }
  return errorResponse(res, 401, "TOKEN_INVALID", "Invalid access token");
}

async function attachDashboardMenuAuth(req, res, decoded) {
  if (!DASHBOARD_MENU_ROLES.has(String(decoded.role || ""))) {
    return errorResponse(res, 403, "FORBIDDEN", "Insufficient dashboard permissions");
  }
  const user = await DashboardUser.findById(decoded.userId)
    .select("_id role isActive passwordChangedAt")
    .lean();
  if (!user || user.isActive === false) {
    return errorResponse(res, 401, "TOKEN_INVALID", "Invalid access token");
  }
  if (!DASHBOARD_MENU_ROLES.has(String(user.role || ""))) {
    return errorResponse(res, 403, "FORBIDDEN", "Insufficient dashboard permissions");
  }
  if (user.passwordChangedAt && decoded.iat) {
    const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
    if (changedAtSec > decoded.iat) {
      return errorResponse(res, 401, "TOKEN_REVOKED", "Token has been revoked");
    }
  }

  req.dashboardUser = user;
  req.dashboardUserId = String(user._id);
  req.dashboardUserRole = String(user.role);
  req.userId = String(user._id);
  req.userRole = String(user.role);
  req.auth = {
    tokenType: "dashboard_access",
    authContext: "dashboard",
    role: String(user.role),
    userId: String(user._id),
  };
  return null;
}

async function attachAppMenuAuth(req, res, decoded) {
  if (decoded.tokenType === "app_guest" || decoded.role === "guest" || decoded.isGuest === true) {
    req.auth = {
      tokenType: "app_guest",
      authContext: "guest",
      role: "guest",
      isGuest: true,
    };
    req.isGuest = true;
    req.userRole = "guest";
    return null;
  }

  if (decoded.tokenType !== "app_access" || decoded.role !== "client" || !decoded.userId) {
    return errorResponse(res, 401, "TOKEN_INVALID", "Invalid access token");
  }

  const user = await User.findById(decoded.userId).select("_id role isActive email phone phoneE164").lean();
  if (!user || user.role !== "client") {
    return errorResponse(res, 401, "TOKEN_INVALID", "Invalid access token");
  }
  if (user.isActive === false) {
    return errorResponse(res, 403, "SESSION_REVOKED", "Session has been revoked");
  }

  req.userId = String(user._id);
  req.userRole = user.role;
  req.authenticatedUser = user;
  req.auth = {
    tokenType: "app_access",
    authContext: "app",
    role: user.role,
    userId: String(user._id),
    isGuest: false,
  };
  return null;
}

async function optionalMenuAccessAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.auth = { authContext: "public" };
    return next();
  }
  if (!authHeader.startsWith("Bearer ")) {
    return errorResponse(res, 401, "TOKEN_INVALID", "Invalid access token");
  }

  const token = authHeader.split(" ")[1];
  const untrusted = jwt.decode(token) || {};
  const isDashboardToken = untrusted.tokenType === "dashboard_access";
  const secret = isDashboardToken ? DASHBOARD_JWT_SECRET : JWT_ACCESS_SECRET;
  const { decoded, error } = verifyWithFallback(token, secret);
  if (error || !decoded) return tokenError(res, error);

  try {
    const blocked = isDashboardToken
      ? await attachDashboardMenuAuth(req, res, decoded)
      : await attachAppMenuAuth(req, res, decoded);
    if (blocked) return blocked;
    return next();
  } catch (_err) {
    return errorResponse(res, 500, "INTERNAL", "Unexpected error during auth");
  }
}

module.exports = optionalMenuAccessAuth;
