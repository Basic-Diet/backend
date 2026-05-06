"use strict";

const mongoose = require("mongoose");
const { resolveOptionalPagination, buildPaginationMeta } = require("../src/utils/optionalPagination");
const adminController = require("../src/controllers/adminController");
const kitchenController = require("../src/controllers/kitchenController");
const orderKitchenController = require("../src/controllers/orderKitchenController");
const orderCourierController = require("../src/controllers/orderCourierController");
const courierController = require("../src/controllers/courierController");
const Subscription = require("../src/models/Subscription");
const SubscriptionDay = require("../src/models/SubscriptionDay");
const Order = require("../src/models/Order");
const Delivery = require("../src/models/Delivery");
const { getTodayKSADate } = require("../src/utils/date");
const { ORDER_STATUSES } = require("../src/utils/orderState");

// Force enable one-time order delivery for testing purposes
process.env.ONE_TIME_ORDER_DELIVERY_ENABLED = "true";

async function runTests() {
  console.log("=== Optional Pagination Integration Tests ===\n");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log("Note: Integration tests require MONGO_URI.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to:", mongoose.connection.name);

  const createMockRes = () => {
    return {
      statusCode: 200,
      body: null,
      status: function(s) { this.statusCode = s; return this; },
      json: function(j) { this.body = j; return this; }
    };
  };

  try {
    const adminSubId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const today = getTodayKSADate();

    await Subscription.deleteMany({});
    await SubscriptionDay.deleteMany({});
    await Order.deleteMany({});
    await Delivery.deleteMany({});

    // --- SETUP DATA ---
    
    // 1. Admin Test: One subscription with 10 days
    await Subscription.create({ 
        _id: adminSubId, 
        userId, 
        planId: new mongoose.Types.ObjectId(), 
        status: "active",
        deliveryMode: "delivery",
        totalMeals: 100,
        remainingMeals: 100
    });
    const adminDays = [];
    for (let i = 1; i <= 10; i++) {
        adminDays.push({
            subscriptionId: adminSubId,
            date: `2026-06-${i.toString().padStart(2, '0')}`,
            status: "open"
        });
    }
    await SubscriptionDay.insertMany(adminDays);

    // 2. Kitchen/Courier Test for SUBSCRIPTION DAYS: 10 unique subscriptions with 1 day each (all on 'today')
    const queueDays = [];
    for (let i = 1; i <= 10; i++) {
        const qSubId = new mongoose.Types.ObjectId();
        await Subscription.create({ 
            _id: qSubId, 
            userId, 
            planId: new mongoose.Types.ObjectId(), 
            status: "active",
            deliveryMode: i % 2 === 0 ? "delivery" : "pickup",
            totalMeals: 20,
            remainingMeals: 20
        });

        queueDays.push({
            subscriptionId: qSubId,
            date: today,
            status: "ready_for_pickup",
            lockedSnapshot: { 
                deliveryMode: i % 2 === 0 ? "delivery" : "pickup", 
                customerName: `Test SubDay ${i}`, 
                deliveryWindow: "Morning" 
            }
        });
    }
    const createdQueueDays = await SubscriptionDay.insertMany(queueDays);

    // 3. Seed 10 Deliveries for SUBSCRIPTION DAYS (used by courierController.listTodayDeliveries)
    const subDeliveries = [];
    for (let i = 0; i < 10; i++) {
        subDeliveries.push({
            subscriptionId: createdQueueDays[i].subscriptionId,
            dayId: createdQueueDays[i]._id,
            status: "scheduled",
            address: { line1: "Test Sub Address" }
        });
    }
    await Delivery.insertMany(subDeliveries);

    // 4. Seed 10 Orders for 'today' (Must be OUT_FOR_DELIVERY for courier list)
    const orders = [];
    for (let i = 1; i <= 10; i++) {
        orders.push({
            userId,
            status: ORDER_STATUSES.OUT_FOR_DELIVERY,
            paymentStatus: "paid",
            fulfillmentMethod: "delivery",
            fulfillmentDate: today,
            deliveryDate: today,
            totalHalala: 10000
        });
    }
    const createdOrders = await Order.insertMany(orders);

    // 5. Seed 10 Deliveries for ORDERS (used by orderCourierController.listTodayOrders)
    const orderDeliveries = [];
    for (let i = 0; i < 10; i++) {
        orderDeliveries.push({
            orderId: createdOrders[i]._id,
            status: "out_for_delivery",
            address: { line1: "Test Order Address" }
        });
    }
    await Delivery.insertMany(orderDeliveries);

    // --- TEST SUITE ---

    async function testEndpoint(name, controllerFn, req, expectedCount, hasMeta) {
      const res = createMockRes();
      await controllerFn(req, res);
      const data = res.body.data;
      const meta = res.body.meta;

      if (res.statusCode !== 200) {
        throw new Error(`${name} failed with status ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
      if (!data || !Array.isArray(data)) {
        throw new Error(`${name} returned non-array data: ${JSON.stringify(res.body)}`);
      }
      if (data.length !== expectedCount) {
        throw new Error(`${name} count mismatch. Expected ${expectedCount}, got ${data.length}`);
      }
      if (hasMeta && !meta) {
        throw new Error(`${name} missing meta`);
      }
      if (!hasMeta && meta) {
        throw new Error(`${name} should not have meta`);
      }
      console.log(`PASS: ${name}`);
    }

    // 1. GET /api/admin/subscriptions/:id/days
    await testEndpoint("Admin Sub Days (No Pagination)", adminController.listSubscriptionDaysAdmin, { params: { id: adminSubId.toString() }, query: {} }, 10, false);
    await testEndpoint("Admin Sub Days (With Pagination)", adminController.listSubscriptionDaysAdmin, { params: { id: adminSubId.toString() }, query: { page: "1", limit: "5" } }, 5, true);

    // 2. GET /api/kitchen/orders/:date (Filters confirmed/in_preparation/ready_for_pickup - Wait, I seeded OUT_FOR_DELIVERY)
    // Actually kitchen list filters include: [CONFIRMED, IN_PREPARATION, READY_FOR_PICKUP]
    // Let's seed 10 MORE orders for kitchen.
    const kitchenOrders = [];
    for (let i = 1; i <= 10; i++) {
        kitchenOrders.push({
            userId,
            status: ORDER_STATUSES.CONFIRMED,
            paymentStatus: "paid",
            fulfillmentMethod: "pickup",
            fulfillmentDate: today,
            deliveryDate: today,
            totalHalala: 5000
        });
    }
    await Order.insertMany(kitchenOrders);
    await testEndpoint("Kitchen Orders (No Pagination)", orderKitchenController.listOrdersByDate, { params: { date: today }, query: {} }, 10, false);

    // 3. GET /api/kitchen/pickups/:date (Filters deliveryMode: pickup) - 5 was expected, let's keep that logic
    await testEndpoint("Kitchen Pickups (No Pagination)", kitchenController.listPickupsByDate, { params: { date: today }, query: {} }, 5, false);
    await testEndpoint("Kitchen Pickups (With Pagination)", kitchenController.listPickupsByDate, { params: { date: today }, query: { page: "1", limit: "3" } }, 3, true);

    // 4. GET /api/kitchen/today-pickup
    await testEndpoint("Kitchen Today Pickups (No Pagination)", kitchenController.listTodayPickups, { params: {}, query: {} }, 5, false);

    // 5. GET /api/courier/orders/today (Filters OUT_FOR_DELIVERY + linked delivery)
    await testEndpoint("Courier Today Orders (No Pagination)", orderCourierController.listTodayOrders, { params: {}, query: {} }, 10, false);
    await testEndpoint("Courier Today Orders (With Pagination)", orderCourierController.listTodayOrders, { params: {}, query: { page: "1", limit: "4" } }, 4, true);

    // 6. GET /api/courier/deliveries/today (Uses SubscriptionDay deliveries)
    await testEndpoint("Courier Today Deliveries (No Pagination)", courierController.listTodayDeliveries, { params: {}, query: {} }, 10, false);
    await testEndpoint("Courier Today Deliveries (With Pagination)", courierController.listTodayDeliveries, { params: {}, query: { page: "2", limit: "6" } }, 4, true);

    // --- INVALID PARAMS TEST ---
    console.log("\nTesting 400 Errors for Invalid Params...");
    const res400 = createMockRes();
    try {
      await adminController.listSubscriptionDaysAdmin({ params: { id: adminSubId.toString() }, query: { page: "0" } }, res400);
      throw new Error("Expected 400 error to be thrown or returned");
    } catch (err) {
      if (err.status !== 400 && res400.statusCode !== 400) throw err;
      console.log("PASS: 400 for page=0");
    }

    const resClamped = createMockRes();
    await adminController.listSubscriptionDaysAdmin({ params: { id: adminSubId.toString() }, query: { limit: "1000" } }, resClamped);
    if (resClamped.body.meta.limit > 365) throw new Error("Limit was not clamped correctly");
    console.log("PASS: limit clamped to max");

    console.log("\nALL PAGINATION INTEGRATION TESTS PASSED!");

  } catch (err) {
    console.error("\nTESTS FAILED:");
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
