const mongoose = require("mongoose");
const path = require("path");

// Load models and services using their exact local paths
const MenuOption = require("../src/models/MenuOption");
const PremiumUpgradeConfig = require("../src/models/PremiumUpgradeConfig");
const { getReadiness } = require("../src/services/subscription/premiumUpgradeConfigService");

const prodUri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  try {
    console.log("Connecting to production DB...");
    await mongoose.connect(prodUri);
    console.log("Connected successfully.\n");

    // 1. Check if qa_premium_protein exists in MenuOption
    const qaOption = await MenuOption.findOne({ key: "qa_premium_protein" }).lean();
    console.log("=== MenuOption Check ===");
    console.log("qa_premium_protein:", qaOption ? JSON.stringify(qaOption, null, 2) : "NOT FOUND");
    console.log("");

    // 2. Check all current PremiumUpgradeConfig entries
    const configs = await PremiumUpgradeConfig.find({}).lean();
    console.log("=== PremiumUpgradeConfig Entries ===");
    console.log(`Total configs found: ${configs.length}`);
    configs.forEach(c => {
      console.log(`- ID: ${c._id}, Key: ${c.premiumKey}, selectionType: ${c.selectionType}, status: ${c.status}, isEnabled: ${c.isEnabled}, isVisible: ${c.isVisible}`);
    });
    console.log("");

    // 3. Run readiness check
    console.log("=== Running getReadiness() ===");
    const readiness = await getReadiness();
    console.log("Readiness Result:", JSON.stringify(readiness, null, 2));

  } catch (err) {
    console.error("Error in check script:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from DB.");
  }
}

main();
