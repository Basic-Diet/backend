require("dotenv").config();
const mongoose = require("mongoose");
const sinon = require("sinon");

const { performDaySelectionValidation } = require("../src/services/subscription/subscriptionSelectionService");
const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");

async function run() {
  const mongoUri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  try {
    const subId = "6a3e895cd0f6de5d9fc7cf41";
    const sub = await Subscription.findById(subId);
    if (!sub) throw new Error("Sub not found");

    // We will update the DB status temporarily so we don't have to stub everything
    const oldStatus = sub.status;
    sub.status = "active";
    await sub.save({ validateBeforeSave: false });

    // Ensure we have a day
    let day = await SubscriptionDay.findOne({ subscriptionId: sub._id, date: "2026-08-01" });
    if (!day) {
        day = new SubscriptionDay({ subscriptionId: sub._id, date: "2026-08-01", status: "open" });
        await day.save({ validateBeforeSave: false });
    }

    const Addon = require("../src/models/Addon");
    const snackAddon = await Addon.findOne({ category: "snack" });
    const requestedIds = snackAddon ? [snackAddon._id.toString()] : [];

    console.log(`Triggering validation for Subscription ${subId} with requested Addons:`, requestedIds);

    await performDaySelectionValidation({
      userId: sub.userId.toString(),
      subscriptionId: subId,
      date: "2026-08-01",
      mealSlots: [],
      contractVersion: "canonical",
      requestedOneTimeAddonIds: requestedIds
    });

    console.log("Validation completed without throwing error! (THIS IS WRONG)");

    // Restore status
    sub.status = oldStatus;
    await sub.save({ validateBeforeSave: false });

  } catch (err) {
    console.log("\n=== CAUGHT EXPECTED ERROR ===");
    console.log(JSON.stringify({ status: err.status, code: err.code, message: err.message }, null, 2));
    
    // Restore status just in case
    const subId = "6a3e895cd0f6de5d9fc7cf41";
    await Subscription.updateOne({ _id: subId }, { $set: { status: "canceled" }});
  } finally {
    await mongoose.disconnect();
  }
}

run();
