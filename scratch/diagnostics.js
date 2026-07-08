require("dotenv").config();
const mongoose = require("mongoose");
const Subscription = require("../src/models/Subscription");

async function run() {
  const uri = process.env.MONGO_URI_TEST || process.env.MONGO_URI; 
  await mongoose.connect(uri);
  const sub = await Subscription.findById("6a3e895cd0f6de5d9fc7cf41").lean();
  console.log("Status of 6a3e895cd0f6de5d9fc7cf41 is:", sub.status);
  await mongoose.disconnect();
}
run();
