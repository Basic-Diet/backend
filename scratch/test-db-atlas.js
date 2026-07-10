require("dotenv").config();
const mongoose = require("mongoose");
const MenuProduct = require("../src/models/MenuProduct");
const ProductOptionGroup = require("../src/models/ProductOptionGroup");
const ProductGroupOption = require("../src/models/ProductGroupOption");
const MenuOptionGroup = require("../src/models/MenuOptionGroup");
const MenuOption = require("../src/models/MenuOption");
const Subscription = require("../src/models/Subscription");

async function main() {
  const uri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";
  console.log("Connecting to Atlas production database...");
  await mongoose.connect(uri);
  console.log("Connected!");

  const subId = "6a5047f9c7ee1a18c1f1196b";
  const sub = await Subscription.findById(subId).lean();
  if (sub) {
    console.log("\nSubscription Found:", JSON.stringify({
      _id: sub._id,
      status: sub.status,
      contractMode: sub.contractMode,
      premiumBalance: sub.premiumBalance
    }, null, 2));
  } else {
    console.log("\nSubscription NOT found:", subId);
  }

  const ids = ["6a3e870b3a3b9944089f8ca6", "6a3e87553a3b9944089f8ed5"];

  for (const id of ids) {
    console.log("\n========================================");
    console.log("PRODUCT ID:", id);
    const product = await MenuProduct.findById(id).lean();
    if (!product) {
      console.log("Product not found");
      continue;
    }
    console.log(`Product Name: ${JSON.stringify(product.name)}`);
    console.log(`Key: ${product.key}, ItemType: ${product.itemType}`);

    const optionGroups = await ProductOptionGroup.find({ productId: id }).lean();
    console.log(`ProductOptionGroups (${optionGroups.length}):`);
    for (const og of optionGroups) {
      const group = await MenuOptionGroup.findById(og.groupId).lean();
      console.log(`  - Group ID: ${og.groupId}, Key: ${group?.key}, Min: ${og.minSelections}, Max: ${og.maxSelections}, Active: ${og.isActive}`);
      
      const groupOptions = await ProductGroupOption.find({ productId: id, groupId: og.groupId }).lean();
      console.log(`    Options inside this relation (${groupOptions.length}):`);
      for (const go of groupOptions) {
        const option = await MenuOption.findById(go.optionId).lean();
        console.log(`      * Option ID: ${go.optionId}, Key: ${option?.key}, Active: ${go.isActive}`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
