const mongoose = require("mongoose");
const { validateCanonicalMealSlots } = require("../src/services/subscription/canonicalMealSlotPlannerService");
const Subscription = require("../src/models/Subscription");

async function main() {
  const uri = "mongodb+srv://hemaatar:011461519790@cluster0.w8vukgr.mongodb.net/basicdiet145?retryWrites=true&w=majority&appName=Cluster0";
  await mongoose.connect(uri);

  const subscription = await Subscription.findById("6a5047f9c7ee1a18c1f1196b").lean();

  const mealSlots = [
    {
      slotIndex: 1,
      slotKey: "slot_1",
      selectionType: "sandwich",
      productId: "6a3e87553a3b9944089f8ed5",
      selectedOptions: []
    },
    {
      slotIndex: 2,
      slotKey: "slot_2",
      selectionType: "premium_meal",
      productId: "6a3e870b3a3b9944089f8ca6",
      selectedOptions: [
        {
          groupId: "6a3e86a73a3b9944089f89a6",
          groupKey: "proteins",
          optionId: "6a3e86aa3a3b9944089f89bb",
          optionKey: "salmon",
          quantity: 1
        }
      ]
    }
  ];

  console.log("Running validateCanonicalMealSlots...");
  const result = await validateCanonicalMealSlots({
    mealSlots,
    mealsPerDayLimit: 2,
    subscription
  });

  console.log("Result:", JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
