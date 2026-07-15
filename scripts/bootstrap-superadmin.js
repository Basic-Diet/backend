#!/usr/bin/env node

require("dotenv").config();

const mongoose = require("mongoose");
const DashboardUser = require("../src/models/DashboardUser");
const { resolveMongoUri } = require("../src/utils/mongoUriResolver");
const {
  normalizeDashboardEmail,
  buildDashboardEmailQuery,
  isValidEmailFormat,
  validateDashboardPassword,
  hashDashboardPassword,
} = require("../src/services/dashboardPasswordService");

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function bootstrapSuperadmin() {
  const email = normalizeDashboardEmail(requiredEnv("SUPERADMIN_EMAIL"));
  const password = requiredEnv("SUPERADMIN_PASSWORD");
  const sync = String(process.env.SUPERADMIN_BOOTSTRAP_SYNC || "").toLowerCase() === "true";

  if (!isValidEmailFormat(email)) throw new Error("SUPERADMIN_EMAIL is invalid");
  const passwordValidation = validateDashboardPassword(password);
  if (!passwordValidation.ok) throw new Error(`SUPERADMIN_PASSWORD: ${passwordValidation.message}`);

  await mongoose.connect(resolveMongoUri(), { serverSelectionTimeoutMS: 10000 });
  try {
    const existing = await DashboardUser.findOne(buildDashboardEmailQuery(email));
    if (existing && !sync) {
      console.log(`[superadmin-bootstrap] Existing account kept: ${email}`);
      return;
    }

    const passwordHash = await hashDashboardPassword(password);
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = "superadmin";
      existing.isActive = true;
      existing.failedAttempts = 0;
      existing.lockUntil = null;
      existing.passwordChangedAt = new Date();
      await existing.save();
      console.log(`[superadmin-bootstrap] Superadmin updated: ${email}`);
      return;
    }

    await DashboardUser.create({
      email,
      passwordHash,
      role: "superadmin",
      isActive: true,
      failedAttempts: 0,
      lockUntil: null,
      passwordChangedAt: new Date(),
    });
    console.log(`[superadmin-bootstrap] Superadmin created: ${email}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  bootstrapSuperadmin().catch(async (err) => {
    console.error(`[superadmin-bootstrap] ${err.message}`);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { bootstrapSuperadmin };
