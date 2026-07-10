require("dotenv").config();
const mongoose = require("mongoose");
const MenuProduct = require("../src/models/MenuProduct");
const Subscription = require("../src/models/Subscription");

async function run(uri, name) {
  try {
    console.log(`\nConnecting to ${name}...`);
    await mongoose.connect(uri);
    console.log("Connected!");

    const productCount = await MenuProduct.countDocuments();
    const subCount = await Subscription.countDocuments();
    console.log(`MenuProducts: ${productCount}, Subscriptions: ${subCount}`);

    if (productCount > 0) {
      const sampleProducts = await MenuProduct.find().limit(5).lean();
      console.log("Sample Products:");
      for (const p of sampleProducts) {
        console.log(`  - ID: ${p._id}, Name: ${JSON.stringify(p.name)}, Key: ${p.key}, ItemType: ${p.itemType}`);
      }
    }
  } catch (err) {
    console.error(`Error with ${name}:`, err.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  await run(process.env.MONGO_URI, "MONGO_URI");
  await run(process.env.MONGO_URI_TEST, "MONGO_URI_TEST");
}

main().catch(console.error);
