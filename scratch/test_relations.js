const mongoose = require('mongoose');
require('dotenv').config();
const { loadEligiblePremiumCandidates } = require('../src/services/subscription/premiumUpgradeConfigService');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/basicdiet145';
  await mongoose.connect(uri);

  const { candidates, diagnostics } = await loadEligiblePremiumCandidates();
  console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2));
  console.log('Candidates list:');
  candidates.forEach(c => {
    console.log(`- key: ${c.premiumKey}, type: ${c.sourceType}, sourceId: ${c.sourceId}, isLinked: ${c.isLinked}`);
  });
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
