const mongoose = require('mongoose');
require('dotenv').config();
const PremiumUpgradeConfig = require('../src/models/PremiumUpgradeConfig');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/basicdiet145';
  await mongoose.connect(uri);
  const configs = await PremiumUpgradeConfig.find({}).lean();
  console.log('Configs Count:', configs.length);
  console.log(JSON.stringify(configs, null, 2));
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
