const assert = require("assert");

const {
  reconcileAddonInclusions,
} = require("../src/services/subscription/subscriptionSelectionService");
const {
  buildAddonEntitlementsReadModel,
} = require("../src/services/subscription/subscriptionAddonEntitlementReadService");

const IDS = {
  juiceMenuProduct: "507f191e810c19729de87001",
  snackMenuProduct: "507f191e810c19729de87002",
  addonPlan: "507f191e810c19729de87003",
};

function choice({ id, category, name = "Choice", priceHalala = 1100 }) {
  return {
    addonCategory: category,
    category: { key: category === "juice" ? "juices" : "desserts" },
    product: {
      _id: id,
      name: { en: name, ar: name },
      priceHalala,
      currency: "SAR",
    },
  };
}

async function assertRejectsWithCode(fn, code) {
  try {
    await fn();
  } catch (err) {
    assert.strictEqual(err.code, code);
    return err;
  }
  throw new Error(`Expected ${code} rejection`);
}

async function run() {
  const resolveChoiceProductById = async (id) => {
    if (String(id) === IDS.juiceMenuProduct) {
      return choice({ id, category: "juice", name: "Berry Blast", priceHalala: 1100 });
    }
    if (String(id) === IDS.snackMenuProduct) {
      return choice({ id, category: "snack", name: "Dark Brownies", priceHalala: 1300 });
    }
    return null;
  };

  const subscription = {
    addonSubscriptions: [
      {
        addonId: IDS.addonPlan,
        category: "juice",
        name: "Daily Juice",
        maxPerDay: 1,
      },
    ],
  };

  const day = { addonSelections: [] };
  await reconcileAddonInclusions(subscription, day, [IDS.juiceMenuProduct], { resolveChoiceProductById });
  assert.strictEqual(day.addonSelections.length, 1);
  assert.strictEqual(String(day.addonSelections[0].addonId), IDS.juiceMenuProduct);
  assert.strictEqual(day.addonSelections[0].category, "juice");
  assert.strictEqual(day.addonSelections[0].source, "subscription");
  assert.strictEqual(day.addonSelections[0].priceHalala, 0);

  await assertRejectsWithCode(
    () => reconcileAddonInclusions(subscription, { addonSelections: [] }, [IDS.snackMenuProduct], { resolveChoiceProductById }),
    "ADDON_ENTITLEMENT_REQUIRED"
  );

  await assertRejectsWithCode(
    () => reconcileAddonInclusions(subscription, { addonSelections: [] }, [IDS.addonPlan], { resolveChoiceProductById }),
    "INVALID_ONE_TIME_ADDON_SELECTION"
  );

  const clearDay = { addonSelections: [{ addonId: IDS.juiceMenuProduct, category: "juice", source: "subscription" }] };
  await reconcileAddonInclusions(subscription, clearDay, [], { resolveChoiceProductById });
  assert.deepStrictEqual(clearDay.addonSelections, []);

  const pendingReadModel = buildAddonEntitlementsReadModel(subscription.addonSubscriptions, []);
  assert.strictEqual(pendingReadModel.juice.subscribed, true);
  assert.strictEqual(pendingReadModel.juice.selectedItem, null);
  assert.strictEqual(pendingReadModel.juice.status, "pending_selection");
  assert.strictEqual(pendingReadModel.snack.status, "not_subscribed");

  const selectedReadModel = buildAddonEntitlementsReadModel(subscription.addonSubscriptions, day.addonSelections);
  assert.strictEqual(selectedReadModel.juice.status, "selected");
  assert.strictEqual(selectedReadModel.juice.selectedItem.menuProductId, IDS.juiceMenuProduct);
  assert.strictEqual(selectedReadModel.juice.selectedItem.priceHalala, 0);
}

run()
  .then(() => {
    console.log("subscription_addon_selection_contract tests passed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
