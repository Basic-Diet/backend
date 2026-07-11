const mongoose = require('mongoose');
require('dotenv').config();
const MenuProduct = require('../src/models/MenuProduct');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/basicdiet145';
  await mongoose.connect(uri);
  const product = await MenuProduct.findById('6a495842991f8d73bc7a2346').lean();
  console.log(JSON.stringify(product, null, 2));
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
