require("dotenv").config();
const mongoose = require("mongoose");
async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  try {
    await db.collection("payments").createIndex(
      { testIdemp: 1 }, 
      { unique: true, partialFilterExpression: { testIdemp: { $type: "string", $gt: "" } } }
    );
    console.log("GT IS SUPPORTED");
    await db.collection("payments").dropIndex("testIdemp_1");
  } catch (e) {
    console.log("GT ERROR:", e.message);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
