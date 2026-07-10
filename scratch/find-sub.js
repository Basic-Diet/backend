require("dotenv").config();
const mongoose = require("mongoose");
const Subscription = require("../src/models/Subscription");
const MenuProduct = require("../src/models/MenuProduct");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MONGO_URI");

  const subId = "6a5047f9c7ee1a18c1f1196b";
  const sub = await Subscription.findById(subId).lean();
  if (sub) {
    console.log("Subscription found:", JSON.stringify(sub, null, 2));
  } else {
    console.log("Subscription not found:", subId);
    // Let's find some subscriptions
    const subs = await Subscription.find().limit(3).lean();
    console.log("Sample subscriptions:");
    for (const s of subs) {
      console.log(`  - ID: ${s._id}, Status: ${s.status}, ContractMode: ${s.contractMode}`);
    }
  }

  // Let's search for products with the keys
  console.log("\nSearching for product keys...");
  const products = await MenuProduct.find().lean();
  for (const p of products) {
    if (p._id.toString() === "6a3e870b3a3b9944089f8ca6" || p._id.toString() === "6a3e87553a3b9944089f8ed5") {
      console.log(`FOUND SPECIFIC PRODUCT ID IN DB: ${p._id} Name: ${p.name.en}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
