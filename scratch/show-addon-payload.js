const mongoose = require("mongoose");
const request = require("supertest");
const { connect, cleanup } = require("../tests/setup/db");
const { seedSettings, seedSubscriptionWithDay, dashboardHeaders, auth, token } = require("../tests/setup/seed");
const { createApp } = require("../src/app");
const { SubscriptionDay } = require("../src/models/subscription");
const { MenuProduct, MenuOptionGroup, MenuOption } = require("../src/models/menu");

const TODAY = new Date().toISOString().split("T")[0];

(async function run() {
  await connect();
  await cleanup();
  await seedSettings();
  const api = request(createApp());

  const { user, subscription, day } = await seedSubscriptionWithDay({
    label: "availability-mixed-items",
    slots: [],
  });

  await SubscriptionDay.updateOne(
    { _id: day._id },
    {
      $set: {
        addonSelections: [
          {
            addonId: new mongoose.Types.ObjectId(),
            key: "berry_juice",
            name: "Berry Juice",
            category: "juice",
            source: "subscription",
            priceHalala: 0,
            currency: "SAR",
          },
        ],
      },
    }
  );

  const res = await api.get(`/api/subscriptions/${subscription._id}/pickup-availability?date=${TODAY}`).set(auth(token(user._id)));
  
  const data = res.body.data;
  console.log("=== dayAddons ===");
  console.log(JSON.stringify(data.dayAddons.map(a => ({ itemId: a.itemId, title: a.title.en, categoryKey: a.categoryKey })), null, 2));

  console.log("\n=== sections.addons.items ===");
  const addonSection = data.sections.find(s => s.sectionKey === "addons");
  console.log(JSON.stringify(addonSection.items.map(a => ({ itemId: a.itemId, title: a.title.en, categoryKey: a.categoryKey })), null, 2));

  console.log("\n=== availableAddonChoices ===");
  console.log(JSON.stringify(data.availableAddonChoices.map(a => ({ itemId: a.itemId, title: a.title.en, categoryKey: a.categoryKey })), null, 2));

  process.exit(0);
})();
