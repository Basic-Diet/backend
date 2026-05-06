const mongoose = require('mongoose');
const { search } = require('../src/services/dashboard/opsSearchService');
const User = require('../src/models/User');
const Subscription = require('../src/models/Subscription');
const Order = require('../src/models/Order');
const SubscriptionDay = require('../src/models/SubscriptionDay');
const assert = require('assert');

async function runTests() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not provided. Skipping test.');
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

  console.log('\n=== Operational Search Hardening Tests ===\n');

  try {
    await test('valid ObjectId lookup bypasses min query length', async () => {
      const userId = new mongoose.Types.ObjectId();
      const subId = new mongoose.Types.ObjectId();
      await User.create({ _id: userId, name: 'Target User', phone: '123456789', role: 'client' });
      await Subscription.create({
          _id: subId,
          userId,
          planId: new mongoose.Types.ObjectId(),
          totalMeals: 10,
          remainingMeals: 10,
          status: 'active',
          contractMode: 'canonical',
          startDate: new Date(),
          endDate: new Date(),
          deliveryMode: 'delivery'
      });
      await SubscriptionDay.create({
          subscriptionId: subId,
          date: '2026-05-10',
          status: 'open',
          plannerState: 'draft'
      });
      
      // Test that valid ObjectId bypasses length check
      const results = await search({ q: String(userId), role: 'admin' });
      expectEqual(results.some(r => r.customer && r.customer.name === 'Target User'), true, 'Found user in DTO results via customer object');
    });

    await test('search rejects short non-ID query', async () => {
      const results = await search({ q: 'ab' });
      expectEqual(results.length, 0, 'Short query rejected');
    });

    await test('subscription search caps at 50', async () => {
      const userId = new mongoose.Types.ObjectId();
      const planId = new mongoose.Types.ObjectId();
      await User.create({ _id: userId, name: 'Bulk User', phone: '111222333', role: 'client' });
      
      const subDocs = [];
      for (let i = 0; i < 60; i++) {
        subDocs.push({ 
            userId, 
            planId,
            totalMeals: 10,
            remainingMeals: 10,
            status: 'active', 
            contractMode: 'canonical', 
            startDate: new Date(), 
            endDate: new Date(),
            deliveryMode: 'pickup'
        });
      }
      await Subscription.insertMany(subDocs);

      const originalFind = Subscription.find;
      let limitValue = 0;
      Subscription.find = function(...args) {
          const query = originalFind.apply(this, args);
          const originalLimit = query.limit;
          query.limit = function(val) {
              limitValue = val;
              return originalLimit.apply(this, [val]);
          };
          return query;
      };

      try {
          await search({ q: '111222333', role: 'admin' });
          expectEqual(limitValue, 50, 'Subscription search should be capped at 50');
      } finally {
          Subscription.find = originalFind;
      }
    });

    await test('exact ObjectId lookup is prioritized over regex', async () => {
        const id = new mongoose.Types.ObjectId();
        await User.create({ _id: id, name: 'Unique Name', phone: '999888777', role: 'client' });
        
        let targetFilter = null;
        const originalFind = User.find;
        User.find = function(filter) {
            if (filter.$or && filter.$or.some(o => String(o._id) === String(id))) {
                targetFilter = filter;
            }
            return originalFind.apply(this, [filter]);
        };

        try {
            await search({ q: String(id), role: 'admin' });
            expectEqual(!!targetFilter, true, 'Exact ID lookup was included in the User query');
        } finally {
            User.find = originalFind;
        }
    });

    await test('ORD-style search behaves as intended', async () => {
        const orderId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();
        await User.create({ _id: userId, name: 'Order Owner', phone: '555444333', role: 'client' });
        await Order.create({ 
            _id: orderId, 
            userId, 
            orderNumber: 'ORD-TEST-123',
            status: 'confirmed',
            paymentStatus: 'paid',
            fulfillmentMethod: 'pickup',
            fulfillmentDate: '2026-05-01',
            totalPriceHalala: 1000,
            items: []
        });

        const results = await search({ q: `ORD-${String(orderId)}`, role: 'admin' });
        expectEqual(results.some(r => String(r.id) === String(orderId)), true, 'Found order by ORD- prefix');
    });

  } finally {
    await User.deleteMany({});
    await Subscription.deleteMany({});
    await Order.deleteMany({});
    await SubscriptionDay.deleteMany({});
    await mongoose.disconnect();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
