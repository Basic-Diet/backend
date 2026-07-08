require("dotenv").config();
const mongoose = require("mongoose");

const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");
const Plan = require("../src/models/Plan");

async function run() {
  const isApplyMode = process.argv.includes("--apply");

  console.log(`Starting addonBalance backfill... Mode: ${isApplyMode ? "APPLY" : "DRY-RUN"}`);

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGO_URI not defined in .env");
    
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const query = {
      "addonSubscriptions.0": { $exists: true },
      $or: [
        { addonBalance: { $exists: false } },
        { addonBalance: { $size: 0 } },
      ],
    };

    const count = await Subscription.countDocuments(query);
    console.log(`Found ${count} subscriptions requiring backfill.`);

    const cursor = Subscription.find(query).populate("planId", "daysCount").cursor();
    
    let processed = 0;
    let modified = 0;

    for await (const sub of cursor) {
      processed++;
      const newBalances = [];

      let requiresManualReview = false;
      const daysCount = sub.planId ? Number(sub.planId.daysCount || 0) : 0;

      for (const ent of sub.addonSubscriptions) {
        if (!ent || !ent.category || !ent.addonId) continue;

        let totalUnits = 0;
        
        if (ent.includedTotalQty !== undefined && ent.includedTotalQty > 0) {
          totalUnits = Number(ent.includedTotalQty);
        } else if (daysCount > 0 && ent.quantityPerDay > 0) {
          totalUnits = daysCount * Number(ent.quantityPerDay);
        } else if (daysCount > 0 && ent.purchasedDailyQty > 0) {
          totalUnits = daysCount * Number(ent.purchasedDailyQty);
        } else {
          // Cannot determine balance natively without guessing maxPerDay. Flag for review.
          requiresManualReview = true;
          break;
        }

        // Query historical consumption for this category
        const auditResult = await SubscriptionDay.aggregate([
          { $match: { subscriptionId: sub._id, status: { $nin: ["skipped", "frozen", "canceled"] } } },
          { $unwind: "$addonSelections" },
          { $match: { "addonSelections.source": "subscription", "addonSelections.category": ent.category } },
          { $group: { _id: null, consumed: { $sum: 1 } } }
        ]);

        const historicallyConsumed = auditResult.length > 0 ? auditResult[0].consumed : 0;
        const remainingQty = Math.max(0, totalUnits - historicallyConsumed);

        newBalances.push({
          addonPlanId: ent.addonPlanId || ent.addonId,
          addonId: ent.addonId,
          category: ent.category,
          name: ent.name || ent.category,
          purchasedDailyQty: ent.quantityPerDay || ent.purchasedDailyQty || 1,
          includedTotalQty: totalUnits,
          purchasedQty: totalUnits,
          consumedQty: historicallyConsumed,
          remainingQty: remainingQty,
          reservedQty: 0
        });
      }

      if (requiresManualReview) {
        console.log(`[${sub._id}] Flagged for MANUAL REVIEW (Missing includedTotalQty and quantityPerDay/daysCount data)`);
        continue;
      }

      if (newBalances.length > 0) {
        if (isApplyMode) {
          sub.addonBalance = newBalances;
          await sub.save({ validateBeforeSave: false });
          modified++;
        }
        console.log(`[${sub._id}] Plan Days: ${daysCount} | Generated ${newBalances.length} buckets. Expected total units: ${newBalances.map(b => `${b.category}: ${b.includedTotalQty} (consumed: ${b.consumedQty}, remaining: ${b.remainingQty})`).join(", ")}`);
      }
    }

    console.log(`Finished processing. Processed: ${processed}. Modified: ${modified}.`);
  } catch (err) {
    console.error("Backfill failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
