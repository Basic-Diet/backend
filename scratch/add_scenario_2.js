const fs = require('fs');
const content = fs.readFileSync('scratch/full_subscription_e2e_cycle.js', 'utf8');

const s2Code = `
async function runScenario2(pJuice, pSnack, pSalad) {
  const SubscriptionDay = require("../src/models/SubscriptionDay");
  const Subscription = require("../src/models/Subscription");
  const { updateBulkDaySelectionsForClient } = require("../src/services/subscription/subscriptionSelectionClientService");

  // 1. Manually mutate the subscription balance to simulate partial depletion
  const sub = await Subscription.findById(testSubId);
  sub.addonBalance.forEach(b => {
    if (b.category === "juice") b.remainingQty = 1; // Only 1 juice left
    if (b.category === "snack") b.remainingQty = 0; // No snacks left
    if (b.category === "small_salad") b.remainingQty = 0; // No salads left
  });
  await sub.save({ validateBeforeSave: false });

  const s2Date = "2026-07-11";
  await new SubscriptionDay({ subscriptionId: testSubId, date: s2Date, status: "open" }).save({ validateBeforeSave: false });
  
  // Request: 2 Juices, 1 Snack, 1 Salad
  const s2ReqAddons = [ 
    pJuice._id.toString(), pJuice._id.toString(), // 2 juices
    pSnack._id.toString(), // 1 snack
    pSalad._id.toString()  // 1 salad
  ]; 
  const s2Req = [{ date: s2Date, mealSlots: [], requestedOneTimeAddonIds: s2ReqAddons }];

  const preSub = await Subscription.findById(testSubId).lean();
  const res = await updateBulkDaySelectionsForClient({
      subscriptionId: testSubId,
      requests: s2Req,
      userId: testUserId.toString(),
      lang: "en",
      runtime: require("../src/services/subscription/runtime").sliceEDefaultRuntime,
      writeLogSafelyFn: () => {},
      loadWalletCatalogMapsSafelyFn: () => ({})
  });
  const postSub = await Subscription.findById(testSubId).lean();
  reports.scenario2 = { preSubBalance: preSub.addonBalance, response: res, postSubBalance: postSub.addonBalance };
}
`;

const updatedContent = content
  .replace('async function runScenarios() {', s2Code + '\nasync function runScenarios() {')
  .replace('await runScenario1(pJuice, pSnack, pSalad);', 'await runScenario1(pJuice, pSnack, pSalad);\n    await runScenario2(pJuice, pSnack, pSalad);');

fs.writeFileSync('scratch/full_subscription_e2e_cycle.js', updatedContent);
console.log('Added Scenario 2');
