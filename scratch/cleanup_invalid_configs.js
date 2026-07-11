const mongoose = require('mongoose');
require('dotenv').config();
const PremiumUpgradeConfig = require('../src/models/PremiumUpgradeConfig');
const { getReadiness } = require('../src/services/subscription/premiumUpgradeConfigService');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/basicdiet145';
  await mongoose.connect(uri);

  console.log('--- Current PremiumUpgradeConfigs in DB ---');
  const configs = await PremiumUpgradeConfig.find({}).lean();
  configs.forEach(c => {
    console.log(`- ID: ${c._id}, premiumKey: ${c.premiumKey}, selectionType: ${c.selectionType}, isEnabled: ${c.isEnabled}, status: ${c.status}`);
  });

  const result = await PremiumUpgradeConfig.deleteMany({ premiumKey: 'chicken_fajita' });
  console.log(`\nDeleted chicken_fajita configs: ${result.deletedCount}`);

  console.log('\n--- Running Readiness Check ---');
  const readiness = await getReadiness();
  console.log(JSON.stringify(readiness, null, 2));

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
