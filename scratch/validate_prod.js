require("dotenv").config();
const mongoose = require("mongoose");

const { performDaySelectionValidation } = require("../src/services/subscription/subscriptionSelectionService");
const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");
const fs = require("fs");

async function run() {
  try {
    const uri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(uri);

    const subId = "6a4e683befab51099ff00b29";
    const sub = await Subscription.findById(subId);
    
    const oldStatus = sub.status;
    sub.status = "active";
    await sub.save({ validateBeforeSave: false });

    const targetDate = "2026-07-09";
    let day = await SubscriptionDay.findOne({ subscriptionId: sub._id, date: targetDate });
    if (!day) {
        day = new SubscriptionDay({ subscriptionId: sub._id, date: targetDate, status: "open" });
        await day.save({ validateBeforeSave: false });
    }

    const juiceEnt = sub.addonSubscriptions.find(e => e.category === "juice");
    const snackEnt = sub.addonSubscriptions.find(e => e.category === "snack");
    const saladEnt = sub.addonSubscriptions.find(e => e.category === "small_salad");

    const requestedIds = [
      ...Array(7).fill(juiceEnt.menuProductIds[0].toString()),
      ...Array(7).fill(snackEnt.menuProductIds[0].toString()),
      ...Array(5).fill(saladEnt.menuProductIds[0].toString())
    ];

    const result = await performDaySelectionValidation({
      userId: sub.userId.toString(),
      subscriptionId: subId,
      date: targetDate,
      mealSlots: [],
      contractVersion: "canonical",
      requestedOneTimeAddonIds: requestedIds
    });

    // Write full result
    fs.writeFileSync("scratch/output.json", JSON.stringify(result, null, 2));

    sub.status = oldStatus;
    await sub.save({ validateBeforeSave: false });

  } catch (err) {
    console.error("Error:", err);
    await Subscription.updateOne({ _id: "6a4e683befab51099ff00b29" }, { $set: { status: "canceled" }});
  } finally {
    await mongoose.disconnect();
  }
}

run();
