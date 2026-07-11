const mongoose = require('mongoose');
require('dotenv').config();
const BuilderProtein = require('../src/models/BuilderProtein');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/basicdiet145';
  await mongoose.connect(uri);
  const proteins = await BuilderProtein.find({}).lean();
  console.log('Builder Proteins Count:', proteins.length);
  const formatted = proteins.map(p => ({
    key: p.key,
    name: p.name?.en,
    isPremium: p.isPremium,
    extraFeeHalala: p.extraFeeHalala,
    premiumKey: p.premiumKey,
    displayCategoryKey: p.displayCategoryKey
  }));
  console.log(JSON.stringify(formatted, null, 2));
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
