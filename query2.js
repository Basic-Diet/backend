const mongoose = require('mongoose');
const MenuProduct = require('./src/models/MenuProduct');
const MenuCategory = require('./src/models/MenuCategory');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const product = await MenuProduct.findOne({ key: 'potatoes_with_meat' }).lean();
  console.log("Product:", JSON.stringify(product, null, 2));

  const category = await MenuCategory.findOne({ key: 'breakfast' }).lean();
  console.log("Category:", JSON.stringify(category, null, 2));

  process.exit(0);
}
run().catch(console.error);
