const mongoose = require('mongoose');
const MenuProduct = require('./src/models/MenuProduct');
const MenuCategory = require('./src/models/MenuCategory');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await MenuProduct.find().sort({ createdAt: -1 }).limit(10).lean();
  console.log("Recent Products:", JSON.stringify(products.map(p => ({ key: p.key, name: p.name.en, selectionType: p.selectionType, treatAsFullMeal: p.action?.treatAsFullMeal, requiresBuilder: p.action?.requiresBuilder, published: !!p.publishedAt })), null, 2));
  
  const categories = await MenuCategory.find().sort({ createdAt: -1 }).limit(5).lean();
  console.log("Recent Categories:", JSON.stringify(categories.map(c => ({ key: c.key, name: c.name.en, selectionType: c.selectionType, published: !!c.publishedAt })), null, 2));
  process.exit(0);
}
run().catch(console.error);
