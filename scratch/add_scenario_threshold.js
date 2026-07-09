const fs = require('fs');
const content = fs.readFileSync('scratch/full_subscription_e2e_cycle.js', 'utf8');

const thresholdCode = `
async function runThresholdTest(pJuice) {
  const SubscriptionDay = require("../src/models/SubscriptionDay");
  const Subscription = require("../src/models/Subscription");
  const { updateBulkDaySelectionsForClient } = require("../src/services/subscription/subscriptionSelectionClientService");

  // Reset the balance to 20 juice
  const sub = await Subscription.findById(testSubId);
  sub.addonBalance.forEach(b => {
    if (b.category === "juice") {
      b.remainingQty = 20;
      b.totalUnits = 20;
    }
  });
  await sub.save({ validateBeforeSave: false });

  // Test 1: exactly 2 items
  const d2 = "2026-07-20";
  await new SubscriptionDay({ subscriptionId: testSubId, date: d2, status: "open" }).save({ validateBeforeSave: false });
  let req = [{ date: d2, mealSlots: [], requestedOneTimeAddonIds: Array(2).fill(pJuice._id.toString()) }];
  
  let res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  reports.thresholdTest2 = res;

  // Test 2: exactly 3 items
  const d3 = "2026-07-21";
  await new SubscriptionDay({ subscriptionId: testSubId, date: d3, status: "open" }).save({ validateBeforeSave: false });
  req = [{ date: d3, mealSlots: [], requestedOneTimeAddonIds: Array(3).fill(pJuice._id.toString()) }];
  
  res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  reports.thresholdTest3 = res;

  // Test 3: exactly 10 items
  const d10 = "2026-07-22";
  await new SubscriptionDay({ subscriptionId: testSubId, date: d10, status: "open" }).save({ validateBeforeSave: false });
  req = [{ date: d10, mealSlots: [], requestedOneTimeAddonIds: Array(10).fill(pJuice._id.toString()) }];
  
  res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  reports.thresholdTest10 = res;
}
`;

const updatedContent = content
  .replace('async function runScenarios() {', thresholdCode + '\nasync function runScenarios() {')
  .replace('await runScenario2(pJuice, pSnack, pSalad);', 'await runScenario2(pJuice, pSnack, pSalad);\n    await runThresholdTest(pJuice);');

fs.writeFileSync('scratch/full_subscription_e2e_cycle.js', updatedContent);
console.log('Added Threshold Test');
