const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const SubscriptionPickupRequest = require("./src/models/SubscriptionPickupRequest");

async function run() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);

  const req = await SubscriptionPickupRequest.findById("6a538bab0939a5714d7e4dd5").lean();
  console.log(JSON.stringify(req, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
