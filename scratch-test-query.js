const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { seedCatalog } = require("./scripts/bootstrap/seed-catalog");
const Plan = require("./src/models/Plan");
const { getAddonSubscriptionOptions } = require("./src/controllers/addonController");

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    },
  };
}

async function run() {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  console.log("Seeding database...");
  await seedCatalog({ sync: true });

  const basePlan = await Plan.findOne({ durationDays: 7 });
  console.log(`Using base planId: ${basePlan._id}`);

  const req = { query: { planId: basePlan._id.toString() } };
  const res = mockResponse();

  await getAddonSubscriptionOptions(req, res);

  console.log("Response Status:", res.statusCode);
  console.log("---------------------------------------");
  console.log("Addons returned:", res.data.data.addons.length);
  
  for (const addon of res.data.data.addons) {
    console.log(`Addon Category: ${addon.category} | Name: ${addon.name} | Price: ${addon.priceLabel}`);
    console.log("Products:");
    for (const p of addon.menuProducts) {
      console.log(`  - ${p.name.en} (Key: ${p.key}, ID: ${p.id || p._id})`);
    }
    console.log("---------------------------------------");
  }

  // Find Small Salad Addon
  const saladAddon = res.data.data.addons.find(a => a.category === "small_salad");
  if (saladAddon) {
    const greenSalad = saladAddon.menuProducts.find(p => p.key === "green_salad");
    if (greenSalad) {
      console.log("SUCCESS: Green Salad - 100g is successfully linked to Small Salad Subscription!");
    } else {
      console.log("FAILURE: Green Salad - 100g not found under Small Salad Subscription.");
    }
  } else {
    console.log("FAILURE: Small Salad addon subscription not found.");
  }

  await mongoose.disconnect();
  await mongoServer.stop();
}

run().catch(console.error);
