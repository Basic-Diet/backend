const mongoose = require("mongoose");
const { getReadiness } = require("../src/services/subscription/premiumUpgradeConfigService");

async function run() {
  await mongoose.connect("mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0");
  const result = await getReadiness();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
run().catch(console.error);
