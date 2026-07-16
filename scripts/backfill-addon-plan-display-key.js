#!/usr/bin/env node
"use strict";

require("dotenv").config();

const mongoose = require("mongoose");
const Addon = require("../src/models/Addon");
const {
  normalizeSubscriptionAddonCategory,
} = require("../src/services/subscription/subscriptionAddonPolicyService");
const { resolveMongoUri } = require("../src/utils/mongoUriResolver");

const APPLY_ENV = "APPLY_ADDON_DISPLAY_KEY_BACKFILL";

function parseArgs(argv = process.argv.slice(2)) {
  const options = { planId: "", displayKey: "", applyRequested: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan-id" && argv[index + 1]) {
      options.planId = String(argv[index + 1]).trim();
      index += 1;
    } else if (arg === "--display-key" && argv[index + 1]) {
      options.displayKey = String(argv[index + 1]).trim();
      index += 1;
    } else if (arg === "--apply") {
      options.applyRequested = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return options;
}

function resolveApplyMode(applyRequested, env = process.env) {
  if (!applyRequested) return false;
  if (String(env[APPLY_ENV] || "").toLowerCase() !== "true") {
    throw new Error(`--apply requires ${APPLY_ENV}=true`);
  }
  return true;
}

function normalizeRequestedDisplayKey(value) {
  const displayKey = normalizeSubscriptionAddonCategory(value);
  if (!displayKey) throw new Error("--display-key must be a normalized display key");
  return displayKey;
}

async function backfillAddonPlanDisplayKey({
  planId,
  displayKey,
  apply = false,
  AddonModel = Addon,
} = {}) {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    throw new Error("--plan-id must be a valid Addon plan ObjectId");
  }
  const normalizedDisplayKey = normalizeRequestedDisplayKey(displayKey);
  const plan = await AddonModel.findOne({ _id: planId, kind: "plan" }).lean();
  if (!plan) throw new Error(`Addon plan not found: ${planId}`);

  const currentDisplayKey = normalizeSubscriptionAddonCategory(plan.displayKey) || "";
  if (currentDisplayKey && currentDisplayKey !== normalizedDisplayKey) {
    throw new Error(
      `Refusing to overwrite existing displayKey "${currentDisplayKey}" with "${normalizedDisplayKey}"`
    );
  }
  const report = {
    mode: apply ? "apply" : "dry_run",
    planId: String(plan._id),
    name: plan.name || null,
    category: plan.category || "",
    previousDisplayKey: currentDisplayKey,
    nextDisplayKey: normalizedDisplayKey,
    status: currentDisplayKey === normalizedDisplayKey ? "already_current" : "would_update",
  };

  if (apply && currentDisplayKey !== normalizedDisplayKey) {
    const result = await AddonModel.updateOne(
      {
        _id: plan._id,
        kind: "plan",
        $or: [
          { displayKey: { $exists: false } },
          { displayKey: null },
          { displayKey: "" },
        ],
      },
      { $set: { displayKey: normalizedDisplayKey } }
    );
    if (!result || result.matchedCount !== 1) {
      throw new Error(`Addon plan changed or disappeared before update: ${planId}`);
    }
    report.status = "updated";
  }

  return report;
}

async function main() {
  const options = parseArgs();
  const apply = resolveApplyMode(options.applyRequested);
  await mongoose.connect(resolveMongoUri(), { serverSelectionTimeoutMS: 10000 });
  try {
    const report = await backfillAddonPlanDisplayKey({ ...options, apply });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(`[addon-display-key-backfill] ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_ENV,
  backfillAddonPlanDisplayKey,
  normalizeRequestedDisplayKey,
  parseArgs,
  resolveApplyMode,
};
