const jwt = require("jsonwebtoken");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "supersecret";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const GUEST_TOKEN_EXPIRES_IN = process.env.GUEST_TOKEN_EXPIRES_IN || "30m";
const PASSWORD_CHANGE_TOKEN_EXPIRES_IN = process.env.PASSWORD_CHANGE_TOKEN_EXPIRES_IN || "10m";

function parseExpiresInSeconds(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(\d+)([smhd])$/i);
  if (!match) return 15 * 60;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  if (unit === "d") return amount * 24 * 60 * 60;
  return 15 * 60;
}

const ACCESS_TOKEN_EXPIRES_SECONDS = parseExpiresInSeconds(ACCESS_TOKEN_EXPIRES_IN);
const GUEST_TOKEN_EXPIRES_SECONDS = parseExpiresInSeconds(GUEST_TOKEN_EXPIRES_IN);
const PASSWORD_CHANGE_TOKEN_EXPIRES_SECONDS = parseExpiresInSeconds(PASSWORD_CHANGE_TOKEN_EXPIRES_IN);

function getUserId(user) {
  return String(user && user._id ? user._id : user);
}

function getUserAuthVersion(user) {
  return Number(user && Number.isFinite(Number(user.authVersion)) ? user.authVersion : 0);
}

function issueAppAccessToken(user) {
  return jwt.sign(
    {
      userId: getUserId(user),
      role: "client",
      tokenType: "app_access",
      authVersion: getUserAuthVersion(user),
    },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function issueCustomerPasswordChangeToken(user) {
  return jwt.sign(
    {
      userId: getUserId(user),
      role: "client",
      tokenType: "customer_password_change",
      authVersion: getUserAuthVersion(user),
      temporaryPasswordGeneration: Number(user.temporaryPasswordGeneration || 0),
    },
    JWT_ACCESS_SECRET,
    { expiresIn: PASSWORD_CHANGE_TOKEN_EXPIRES_IN }
  );
}

function issueGuestAccessToken() {
  return jwt.sign(
    {
      role: "guest",
      isGuest: true,
      tokenType: "app_guest",
    },
    JWT_ACCESS_SECRET,
    { expiresIn: GUEST_TOKEN_EXPIRES_IN }
  );
}

module.exports = {
  issueAppAccessToken,
  issueGuestAccessToken,
  issueCustomerPasswordChangeToken,
  JWT_ACCESS_SECRET,
  ACCESS_TOKEN_EXPIRES_SECONDS,
  ACCESS_TOKEN_EXPIRES_IN,
  GUEST_TOKEN_EXPIRES_SECONDS,
  GUEST_TOKEN_EXPIRES_IN,
  PASSWORD_CHANGE_TOKEN_EXPIRES_SECONDS,
  PASSWORD_CHANGE_TOKEN_EXPIRES_IN,
};
