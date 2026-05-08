#!/usr/bin/env node

require("dotenv").config();

const mongoose = require("mongoose");
const seed = require("../../scripts/seed-one-time-menu");

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/basicdiet";
const PRODUCTION_SEED_OVERRIDE = "MENU_SEED_ALLOW_PRODUCTION";

function isExplicitlyAllowed(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function assertSafeSeedTarget() {
  if (process.env.NODE_ENV !== "production") return;
  if (isExplicitlyAllowed(process.env[PRODUCTION_SEED_OVERRIDE])) return;
  console.error(
    [
      "[seed-one-time-menu] Refusing to seed one-time menu while NODE_ENV=production.",
      "Use a local or staging database for validation.",
      `If this is an intentional production menu seed, rerun with ${PRODUCTION_SEED_OVERRIDE}=true.`,
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  assertSafeSeedTarget();
  await mongoose.connect(uri);
  const result = await seed.seedOneTimeMenu({
    actor: { role: "script" },
    notes: "Seed one-time pickup menu",
    mode: process.env.MENU_SEED_MODE,
  });
  if (result.skipped) {
    console.log(`Skipped one-time menu seed because catalog data already exists (mode=${result.mode})`);
  } else {
    console.log(`Seeded one-time menu: ${result.products} products (mode=${result.mode})`);
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = seed;
