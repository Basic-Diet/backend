process.env.NODE_ENV = "test";

const assert = require("assert");
const {
  backfillAddonPlanDisplayKey,
  normalizeRequestedDisplayKey,
  parseArgs,
  resolveApplyMode,
} = require("../scripts/backfill-addon-plan-display-key");

async function run() {
  const planId = "6a57860863e85fba4f858b52";
  assert.deepStrictEqual(
    parseArgs(["--plan-id", planId, "--display-key", "Ice Cream"]),
    { planId, displayKey: "Ice Cream", applyRequested: false }
  );
  assert.strictEqual(normalizeRequestedDisplayKey("Ice Cream"), "ice_cream");
  assert.strictEqual(resolveApplyMode(false, {}), false);
  assert.throws(
    () => resolveApplyMode(true, {}),
    /APPLY_ADDON_DISPLAY_KEY_BACKFILL=true/
  );
  assert.strictEqual(
    resolveApplyMode(true, { APPLY_ADDON_DISPLAY_KEY_BACKFILL: "true" }),
    true
  );

  const updates = [];
  const plan = {
    _id: planId,
    kind: "plan",
    name: { ar: "ايس كريم", en: "ice cream" },
    category: "snack",
    displayKey: "",
  };
  const AddonModel = {
    findOne(query) {
      assert.deepStrictEqual(query, { _id: planId, kind: "plan" });
      return { lean: async () => plan };
    },
    async updateOne(filter, update) {
      updates.push({ filter, update });
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };

  const dryRun = await backfillAddonPlanDisplayKey({
    planId,
    displayKey: "ice_cream",
    AddonModel,
  });
  assert.strictEqual(dryRun.mode, "dry_run");
  assert.strictEqual(dryRun.category, "snack");
  assert.strictEqual(dryRun.nextDisplayKey, "ice_cream");
  assert.strictEqual(dryRun.status, "would_update");
  assert.deepStrictEqual(updates, []);

  const applied = await backfillAddonPlanDisplayKey({
    planId,
    displayKey: "ice_cream",
    apply: true,
    AddonModel,
  });
  assert.strictEqual(applied.mode, "apply");
  assert.strictEqual(applied.status, "updated");
  assert.deepStrictEqual(updates, [{
    filter: {
      _id: planId,
      kind: "plan",
      $or: [
        { displayKey: { $exists: false } },
        { displayKey: null },
        { displayKey: "" },
      ],
    },
    update: { $set: { displayKey: "ice_cream" } },
  }]);

  await assert.rejects(
    () => backfillAddonPlanDisplayKey({ planId: "invalid", displayKey: "ice_cream", AddonModel }),
    /valid Addon plan ObjectId/
  );
  await assert.rejects(
    () => backfillAddonPlanDisplayKey({ planId, displayKey: "***", AddonModel }),
    /normalized display key/
  );
  await assert.rejects(
    () => backfillAddonPlanDisplayKey({
      planId,
      displayKey: "ice_cream",
      AddonModel: {
        findOne: () => ({ lean: async () => ({ ...plan, displayKey: "snack" }) }),
      },
    }),
    /Refusing to overwrite existing displayKey/
  );

  console.log("add-on displayKey backfill tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
