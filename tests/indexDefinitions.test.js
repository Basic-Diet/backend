const Order = require('../src/models/Order');
const User = require('../src/models/User');
const SubscriptionDay = require('../src/models/SubscriptionDay');
const ActivityLog = require('../src/models/ActivityLog');
const NotificationLog = require('../src/models/NotificationLog');

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  function hasIndex(model, fields) {
    const indexes = model.schema.indexes();
    return indexes.some(idx => {
      const idxFields = idx[0];
      const keys = Object.keys(fields);
      if (keys.length !== Object.keys(idxFields).length) return false;
      return keys.every(k => idxFields[k] === fields[k]);
    });
  }

  console.log('\n=== Index Definition Verification ===\n');

  test('User model has { role: 1, createdAt: -1 } index', () => {
    const found = hasIndex(User, { role: 1, createdAt: -1 });
    if (!found) {
        console.log('Current User Indexes:', JSON.stringify(User.schema.indexes(), null, 2));
        throw new Error('Index { role: 1, createdAt: -1 } not found in User schema');
    }
  });

  test('SubscriptionDay model has { date: 1, status: 1, updatedAt: -1 } index', () => {
    const found = hasIndex(SubscriptionDay, { date: 1, status: 1, updatedAt: -1 });
    if (!found) {
        console.log('Current SubscriptionDay Indexes:', JSON.stringify(SubscriptionDay.schema.indexes(), null, 2));
        throw new Error('Index { date: 1, status: 1, updatedAt: -1 } not found in SubscriptionDay schema');
    }
  });

  test('SubscriptionDay dashboard index has background: true property', () => {
    const indexes = SubscriptionDay.schema.indexes();
    const idx = indexes.find(i => i[0].date === 1 && i[0].status === 1 && i[0].updatedAt === -1);
    if (!idx || !idx[1] || idx[1].background !== true) {
        throw new Error('Index should have background: true');
    }
  });

  test('Order model has canonical operational index', () => {
    const expectedFields = { fulfillmentDate: 1, paymentStatus: 1, status: 1, fulfillmentMethod: 1, updatedAt: -1 };
    const found = hasIndex(Order, expectedFields);
    if (!found) {
        console.log('Current Order Indexes:', JSON.stringify(Order.schema.indexes(), null, 2));
        throw new Error('Canonical Order index not found');
    }
    const idx = Order.schema.indexes().find(i => i[1] && i[1].name === 'idx_ops_canonical_date');
    if (!idx || idx[1].background !== true) {
        throw new Error('Canonical Order index missing background: true or correct name');
    }
  });

  test('ActivityLog has typed history index', () => {
    const found = hasIndex(ActivityLog, { entityType: 1, createdAt: -1 });
    if (!found) {
        throw new Error('Index { entityType: 1, createdAt: -1 } not found in ActivityLog');
    }
    const idx = ActivityLog.schema.indexes().find(i => i[0].entityType === 1 && i[0].createdAt === -1);
    if (!idx[1] || idx[1].background !== true) {
        throw new Error('ActivityLog typed history index missing background: true');
    }
  });

  test('NotificationLog has user history index', () => {
    const found = hasIndex(NotificationLog, { userId: 1, createdAt: -1 });
    if (!found) {
        throw new Error('Index { userId: 1, createdAt: -1 } not found in NotificationLog');
    }
    const idx = NotificationLog.schema.indexes().find(i => i[0].userId === 1 && i[0].createdAt === -1);
    if (!idx[1] || idx[1].background !== true) {
        throw new Error('NotificationLog user history index missing background: true');
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

try {
  runTests();
} catch (err) {
  console.error(err);
  process.exit(1);
}
