const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Plan = require("./src/models/Plan");

async function run() {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const basePlan = await Plan.create({
    key: "base_30_days",
    name: { en: "Base 30 Days", ar: "30 يوم" },
    daysCount: 30,
    durationDays: 30,
    isActive: true,
    active: true,
    isAvailable: true,
    available: true,
  });

  const query = Plan.getSellableQuery();
  console.log("Query:", query);
  
  const found = await Plan.findOne(query);
  console.log("Found plan?", !!found);

  await mongoose.disconnect();
  await mongoServer.stop();
}

run().catch(console.error);
