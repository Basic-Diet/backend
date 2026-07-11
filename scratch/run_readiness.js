const mongoose = require('mongoose');
require('dotenv').config();
const { getReadiness } = require('../src/services/subscription/premiumUpgradeConfigService');

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/basicdiet145';
  console.log('Connecting to:', uri.replace(/:[^@]+@/, ':***@'));
  await mongoose.connect(uri);
  console.log('Connected. Running getReadiness...');
  const readiness = await getReadiness();
  console.log('Readiness Result:');
  console.log(JSON.stringify(readiness, null, 2));
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
