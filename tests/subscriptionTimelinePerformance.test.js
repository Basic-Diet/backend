const mongoose = require('mongoose');
const { buildSubscriptionTimeline } = require('../src/services/subscription/subscriptionTimelineService');
const BuilderProtein = require('../src/models/BuilderProtein');
const Subscription = require('../src/models/Subscription');
const SubscriptionDay = require('../src/models/SubscriptionDay');
const assert = require('assert');

async function runTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not provided. Skipping integration test.');
    process.exit(0);
  }

  await mongoose.connect(mongoUri);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  function expectEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
  }

  console.log('\n=== Subscription Timeline Performance Tests ===\n');

  try {
    await test('premiumBalanceBreakdown still returns same shape after bulk-fetch fix', async () => {
      const displayCategoryId = new mongoose.Types.ObjectId();
      const protein1 = await BuilderProtein.create({ 
          name: { en: 'P1' }, 
          premiumKey: 'p1_key',
          displayCategoryId,
          displayCategoryKey: 'premium',
          proteinFamilyKey: 'beef',
          isPremium: true
      });
      const protein2 = await BuilderProtein.create({ 
          name: { en: 'P2' }, 
          premiumKey: 'p2_key',
          displayCategoryId,
          displayCategoryKey: 'premium',
          proteinFamilyKey: 'fish',
          isPremium: true
      });

      const legacySubId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const planId = new mongoose.Types.ObjectId();
      
      await mongoose.connection.db.collection('subscriptions').insertOne({
          _id: legacySubId,
          userId,
          planId,
          totalMeals: 10,
          remainingMeals: 10,
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-05-05'),
          status: 'active',
          contractMode: 'canonical',
          premiumBalance: [
            { proteinId: protein1._id, purchasedQty: 5, remainingQty: 2, name: 'P1' },
            { proteinId: protein2._id, purchasedQty: 3, remainingQty: 1, name: 'P2' }
          ]
      });

      const originalFind = BuilderProtein.find;
      let findCount = 0;
      BuilderProtein.find = function(...args) {
        findCount++;
        return originalFind.apply(this, args);
      };

      try {
        const timeline = await buildSubscriptionTimeline(legacySubId, { lang: 'en', businessDate: '2026-05-01' });

        expectEqual(timeline.premiumBalanceBreakdown.length, 2, 'Breakdown length');
        expectEqual(timeline.premiumBalanceBreakdown[0].premiumKey, 'p1_key', 'P1 key');
        expectEqual(timeline.premiumBalanceBreakdown[1].premiumKey, 'p2_key', 'P2 key');
        expectEqual(findCount, 1, 'Should perform exactly ONE batch query for proteins');
      } finally {
        BuilderProtein.find = originalFind;
      }
    });

    await test('premiumBalanceBreakdown handles missing keys with fallback', async () => {
      const legacySubId = new mongoose.Types.ObjectId();
      await mongoose.connection.db.collection('subscriptions').insertOne({
        _id: legacySubId,
        userId: new mongoose.Types.ObjectId(),
        planId: new mongoose.Types.ObjectId(),
        totalMeals: 5,
        remainingMeals: 5,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-01'),
        status: 'active',
        contractMode: 'canonical',
        premiumBalance: [
          { name: 'Shrimp', purchasedQty: 1, remainingQty: 1 }
        ]
      });

      const timeline = await buildSubscriptionTimeline(legacySubId, { lang: 'en', businessDate: '2026-05-01' });
      expectEqual(timeline.premiumBalanceBreakdown[0].premiumKey, 'shrimp', 'Fallback to name resolution');
    });

  } finally {
    await BuilderProtein.deleteMany({});
    await Subscription.deleteMany({});
    await mongoose.disconnect();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
