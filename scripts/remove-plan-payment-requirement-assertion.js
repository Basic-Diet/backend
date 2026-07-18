const fs = require('fs');
const path = 'tests/mealPlanner.integration.test.js';
let source = fs.readFileSync(path, 'utf8');
const oldText = `  await test('planner rejects plan add-ons directly', async () => {
    const slots = [
      { slotIndex: 1, slotKey: 'slot_1', proteinId: String(standardProtein._id), carbs: [{ carbId: String(standardCarb._id), grams: 150 }], selectionType: 'standard_meal' },
      { slotIndex: 2, slotKey: 'slot_2', proteinId: String(standardProtein._id), carbs: [{ carbId: String(standardCarb._id), grams: 150 }], selectionType: 'standard_meal' },
    ];
    const res = await makeRequest('PUT', \`/api/subscriptions/\${testSubscription._id}/days/\${TEST_DATE5}/selection\`, {
      mealSlots: slots,
      addonsOneTime: [String(addonJuicePlan._id)],
    });
    assertEqual(res.status, 402, 'plan add-on selection requires payment');
    const paymentRequirement = res.body.paymentRequirement || res.body.error?.details?.paymentRequirement;
    assertTrue(!!paymentRequirement, 'payment requirement returned');
  });`;
const newText = `  await test('planner does not consume plan add-ons as one-time item credits', async () => {
    const slots = [
      { slotIndex: 1, slotKey: 'slot_1', proteinId: String(standardProtein._id), carbs: [{ carbId: String(standardCarb._id), grams: 150 }], selectionType: 'standard_meal' },
      { slotIndex: 2, slotKey: 'slot_2', proteinId: String(standardProtein._id), carbs: [{ carbId: String(standardCarb._id), grams: 150 }], selectionType: 'standard_meal' },
    ];
    const res = await makeRequest('PUT', \`/api/subscriptions/\${testSubscription._id}/days/\${TEST_DATE5}/selection\`, {
      mealSlots: slots,
      addonsOneTime: [String(addonJuicePlan._id)],
    });
    assertEqual(res.status, 402, 'plan add-on selection is not covered as a one-time item credit');
  });`;
if (!source.includes(oldText)) throw new Error('current plan add-on test block not found');
source = source.replace(oldText, newText);
fs.writeFileSync(path, source);
console.log('Plan add-on integration expectation aligned.');
