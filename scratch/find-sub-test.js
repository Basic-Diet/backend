require("dotenv").config();
const mongoose = require("mongoose");
const Subscription = require("../src/models/Subscription");
const MenuProduct = require("../src/models/MenuProduct");

async function main() {
  const uri = process.env.MONGO_URI_TEST || "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145_test?retryWrites=true&w=majority&appName=Cluster0";
  console.log("Connecting to MONGO_URI_TEST:", uri);
  await mongoose.connect(uri);
  console.log("Connected!");

  const subId = "6a5047f9c7ee1a18c1f1196b";
  const sub = await Subscription.findById(subId).lean();
  if (sub) {
    console.log("Subscription found in MONGO_URI_TEST:", JSON.stringify(sub, null, 2));
  } else {
    console.log("Subscription not found in MONGO_URI_TEST:", subId);
    // Let's find some subscriptions
    const subs = await Subscription.find().limit(3).lean();
    console.log("Sample subscriptions in MONGO_URI_TEST:");
    for (const s of subs) {
      console.log(`  - ID: ${s._id}, Status: ${s.status}, ContractMode: ${s.contractMode}`);
    }
  }

  // Let's search for products with the keys
  console.log("\nSearching for product keys...");
  const products = await MenuProduct.find().lean();
  console.log(`Total MenuProducts in MONGO_URI_TEST: ${products.length}`);
  for (const p of products) {
    if (p._id.toString() === "6a3e870b3a3b9944089f8ca6" || p._id.toString() === "6a3e87553a3b9944089f8ed5") {
      console.log(`FOUND SPECIFIC PRODUCT ID IN MONGO_URI_TEST DB: ${p._id} Name: ${p.name.en}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
