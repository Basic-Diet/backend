
const mongoose = require("mongoose");
const { buildPhase1SubscriptionContract, buildCanonicalDraftPersistenceFields } = require("./src/services/subscription/subscriptionContractService");
const { buildCanonicalSubscriptionActivationPayload } = require("./src/services/subscription/subscriptionActivationService");
const { buildPickupLocationSummary } = require("./src/services/subscription/subscriptionFulfillmentSummaryService");

async function check() {
  const quote = {
    plan: { _id: new mongoose.Types.ObjectId(), daysCount: 1, currency: "SAR", name: { ar: "Plan", en: "Plan" } },
    grams: 300,
    mealsPerDay: 2,
    startDate: new Date("2026-05-20T00:00:00Z"),
    delivery: { 
      type: "pickup", 
      pickupLocationId: "branch_1",
      address: { city: "Riyadh", street: "Main St" },
      slot: { type: "pickup", window: "10:00-12:00", slotId: "s1" }
    },
    breakdown: {
      basePlanPriceHalala: 5000,
      totalHalala: 5000,
      vatPercentage: 15,
      vatHalala: 652,
      subtotalHalala: 4348
    }
  };

  console.log("--- Quote Delivery ---");
  console.log(JSON.stringify(quote.delivery, null, 2));

  const contract = buildPhase1SubscriptionContract({
    payload: {},
    resolvedQuote: quote,
    actorContext: { actorRole: "client", actorUserId: new mongoose.Types.ObjectId() },
    source: "customer_checkout"
  });

  console.log("\n--- Contract Snapshot Delivery ---");
  console.log(JSON.stringify(contract.contractSnapshot.delivery, null, 2));

  const draftFields = buildCanonicalDraftPersistenceFields({ contract });
  
  // Simulate CheckoutDraft model behavior
  const draftDoc = {
    ...draftFields,
    userId: contract.contractSnapshot.origin.actorUserId,
    planId: contract.contractSnapshot.plan.planId,
    delivery: {
        type: quote.delivery.type,
        address: quote.delivery.address,
        slot: quote.delivery.slot,
        pickupLocationId: quote.delivery.pickupLocationId // Now persisted!
    }
  };

  const { subscriptionPayload } = await buildCanonicalSubscriptionActivationPayload({ draft: draftDoc });
  
  console.log("\n--- Activated Subscription Payload ---");
  console.log("pickupLocationId:", subscriptionPayload.pickupLocationId);
  console.log("deliverySlot:", JSON.stringify(subscriptionPayload.deliverySlot, null, 2));

  const pickupLocations = [
    { id: "branch_1", name: { en: "Branch 1" }, address: { city: "Riyadh" } }
  ];
  
  const summary = buildPickupLocationSummary(subscriptionPayload, pickupLocations, "en");
  console.log("\n--- Fulfillment Summary pickupLocation ---");
  console.log(JSON.stringify(summary, null, 2));
}

check().catch(console.error);
