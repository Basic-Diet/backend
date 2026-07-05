require("dotenv").config();
const mongoose = require("mongoose");
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    if (/meal|category|product|catalog/i.test(c.name)) {
      const count = await db.collection(c.name).countDocuments();
      console.log(c.name, count);
    }
  }
  await mongoose.disconnect();
}
run().catch(console.error);
