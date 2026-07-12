const mongoose = require("mongoose");
const PremiumUpgradeConfig = require("../src/models/PremiumUpgradeConfig");
const { getReadiness } = require("../src/services/subscription/premiumUpgradeConfigService");

const prodUri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  try {
    console.log("Connecting to production DB...");
    await mongoose.connect(prodUri);
    console.log("Connected successfully.\n");

    console.log("Deleting stale postman test configurations...");
    const deleteResult = await PremiumUpgradeConfig.deleteMany({
      premiumKey: /^postman-/
    });
    console.log(`Deleted ${deleteResult.deletedCount} stale configurations.\n`);

    // Verify readiness
    console.log("Checking premium readiness...");
    const readiness = await getReadiness();
    console.log("Readiness result:", JSON.stringify(readiness, null, 2));

  } catch (err) {
    console.error("Error running cleanup script:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from DB.");
  }
}

main();
