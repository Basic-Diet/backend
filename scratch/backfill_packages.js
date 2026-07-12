const mongoose = require("mongoose");
const Plan = require("../src/models/Plan");

async function run() {
  await mongoose.connect("mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0");
  const res = await Plan.updateMany(
    { $or: [ { isDeleted: { $exists: false } }, { category: { $exists: false } } ] },
    { $set: { isDeleted: false, category: "other" } }
  );
  console.log(`Updated ${res.modifiedCount} plans with soft-delete/category fields.`);
  process.exit(0);
}
run().catch(console.error);
