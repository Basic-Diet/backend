#!/usr/bin/env node

require("dotenv").config();
const mongoose = require("mongoose");

const Plan = require("../src/models/Plan");

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
const SYSTEM_CURRENCY = "SAR";
const EXPECTED_PLAN_COUNT = 27;

function name(ar, en = ar) {
  return { ar, en };
}

function createPlanKey(mealsPerDay, durationDays, grams) {
  return `subscription_${mealsPerDay}_meal_${durationDays}_days_${grams}g`;
}

const priceMatrixHalala = {
  1: {
    7: { 100: 11500, 150: 14500, 200: 17500 },
    26: { 100: 43000, 150: 54900, 200: 62500 },
    30: { 100: 48900, 150: 60000, 200: 69000 },
  },
  2: {
    7: { 100: 23000, 150: 29000, 200: 35000 },
    26: { 100: 77900, 150: 98800, 200: 118400 },
    30: { 100: 89900, 150: 110900, 200: 134900 },
  },
  3: {
    7: { 100: 34500, 150: 43500, 200: 52500 },
    26: { 100: 112900, 150: 144300, 200: 167700 },
    30: { 100: 125900, 150: 161900, 200: 189900 },
  },
};

function buildSkipPolicy(durationDays) {
  if (durationDays === 7) return { enabled: true, maxDays: 1 };
  if (durationDays === 26) return { enabled: true, maxDays: 3 };
  return { enabled: true, maxDays: 4 };
}

function buildFreezePolicy(durationDays) {
  if (durationDays === 7) return { enabled: true, maxDays: 7, maxTimes: 1 };
  if (durationDays === 26) return { enabled: true, maxDays: 14, maxTimes: 2 };
  return { enabled: true, maxDays: 21, maxTimes: 2 };
}

function buildSubscriptionPlanRows() {
  const rows = [];
  const mealCounts = Object.keys(priceMatrixHalala).map(Number).sort((a, b) => a - b);

  for (const mealsPerDay of mealCounts) {
    const durations = Object.keys(priceMatrixHalala[mealsPerDay]).map(Number).sort((a, b) => a - b);
    for (const durationDays of durations) {
      const gramSizes = Object.keys(priceMatrixHalala[mealsPerDay][durationDays]).map(Number).sort((a, b) => a - b);
      for (const grams of gramSizes) {
        const priceHalala = priceMatrixHalala[mealsPerDay][durationDays][grams];
        const key = createPlanKey(mealsPerDay, durationDays, grams);
        rows.push({
          key,
          mealsPerDay,
          durationDays,
          mealSizeGrams: grams,
          daysCount: durationDays,
          sortOrder: (mealsPerDay * 1000) + (durationDays * 10) + grams,
          name: name(
            `اشتراك ${durationDays} يوم - ${mealsPerDay} وجبة - ${grams} جرام`,
            `${durationDays} Days Subscription - ${mealsPerDay} Meal${mealsPerDay === 1 ? "" : "s"} - ${grams}g`
          ),
          description: name(
            `اشتراك لمدة ${durationDays} يوم، ${mealsPerDay} وجبة يومياً، حجم ${grams} جرام.`,
            `${durationDays}-day subscription, ${mealsPerDay} meal${mealsPerDay === 1 ? "" : "s"} per day, ${grams}g portion.`
          ),
          currency: SYSTEM_CURRENCY,
          skipPolicy: buildSkipPolicy(durationDays),
          freezePolicy: buildFreezePolicy(durationDays),
          gramsOptions: [
            {
              grams,
              sortOrder: 1,
              isActive: true,
              mealsOptions: [
                {
                  mealsPerDay,
                  priceHalala,
                  compareAtHalala: priceHalala,
                  isActive: true,
                  sortOrder: 1,
                },
              ],
            },
          ],
          isActive: true,
        });
      }
    }
  }

  return rows;
}

const subscriptionPlanRows = buildSubscriptionPlanRows();
const subscriptionPlanKeys = subscriptionPlanRows.map((row) => row.key);

function assertSubscriptionPlanRows() {
  if (subscriptionPlanRows.length !== EXPECTED_PLAN_COUNT) {
    throw new Error(`Expected ${EXPECTED_PLAN_COUNT} subscription plans, got ${subscriptionPlanRows.length}`);
  }

  const uniqueKeys = new Set(subscriptionPlanKeys);
  if (uniqueKeys.size !== EXPECTED_PLAN_COUNT) {
    throw new Error(`Expected ${EXPECTED_PLAN_COUNT} unique subscription plan keys, got ${uniqueKeys.size}`);
  }

  for (const row of subscriptionPlanRows) {
    const gramsOption = row.gramsOptions[0];
    const mealOption = gramsOption && gramsOption.mealsOptions && gramsOption.mealsOptions[0];
    const expectedPrice = priceMatrixHalala[row.mealsPerDay]?.[row.durationDays]?.[row.mealSizeGrams];
    if (!mealOption || mealOption.priceHalala !== expectedPrice) {
      throw new Error(`Invalid price for ${row.key}: expected ${expectedPrice}, got ${mealOption && mealOption.priceHalala}`);
    }
  }
}

async function seedSubscriptionPlans({ log = console } = {}) {
  assertSubscriptionPlanRows();

  let created = 0;
  let updated = 0;

  for (const row of subscriptionPlanRows) {
    const existing = await Plan.findOne({ key: row.key }).select("_id").lean();
    await Plan.updateOne(
      { key: row.key },
      { $set: row },
      { upsert: true, runValidators: true }
    );

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const foundCount = await Plan.countDocuments({ key: { $in: subscriptionPlanKeys } });
  const samplePlan = await Plan.findOne({ key: subscriptionPlanKeys[0] }).lean();

  log.log(`Subscription plans created: ${created}`);
  log.log(`Subscription plans updated: ${updated}`);
  log.log(`Expected seeded subscription plan count: ${EXPECTED_PLAN_COUNT}`);
  log.log(`Found seeded subscription plan count: ${foundCount}`);

  if (foundCount !== EXPECTED_PLAN_COUNT) {
    throw new Error(`Seeded subscription plan count mismatch: expected ${EXPECTED_PLAN_COUNT}, found ${foundCount}`);
  }

  return {
    expectedCount: EXPECTED_PLAN_COUNT,
    foundCount,
    created,
    updated,
    keys: subscriptionPlanKeys,
    samplePlan,
  };
}

async function main() {
  if (!uri) throw new Error("MONGO_URI or MONGODB_URI is required");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB for subscription plans seeding.");

  try {
    const result = await seedSubscriptionPlans();
    const sampleMealOption = result.samplePlan.gramsOptions[0].mealsOptions[0];
    console.log("Sample seeded plan:", {
      key: result.samplePlan.key,
      daysCount: result.samplePlan.daysCount,
      mealsPerDay: result.samplePlan.mealsPerDay,
      mealSizeGrams: result.samplePlan.mealSizeGrams,
      priceHalala: sampleMealOption.priceHalala,
    });
    console.log("Subscription plans seed complete.");
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  });
}

module.exports = {
  EXPECTED_PLAN_COUNT,
  createPlanKey,
  priceMatrixHalala,
  seedSubscriptionPlans,
  subscriptionPlanKeys,
  subscriptionPlanRows,
};
