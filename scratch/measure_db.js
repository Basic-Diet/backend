const mongoose = require("mongoose");
const CatalogItem = require("../src/models/CatalogItem");
const uri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  const start = Date.now();
  console.log("Connecting...");
  await mongoose.connect(uri);
  console.log(`Connected in ${Date.now() - start}ms`);

  const startQuery = Date.now();
  const count = await CatalogItem.countDocuments({});
  console.log(`Counted ${count} CatalogItems in ${Date.now() - startQuery}ms`);

  const startFindOne = Date.now();
  const item = await CatalogItem.findOne({ key: "chicken" });
  console.log(`Found item in ${Date.now() - startFindOne}ms:`, item?.key);

  await mongoose.disconnect();
}
main().catch(console.error);
