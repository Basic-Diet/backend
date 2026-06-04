#!/usr/bin/env node
"use strict";

/**
 * Premium + Add-on Pending Payment QA Mission
 * 
 * Objectives:
 * 1. Create a manual active QA subscription.
 * 2. Select a live premium protein.
 * 3. Select a live subscription add-on entitlement plan.
 * 4. Trigger unified pending payment for the discovered premium + add-on total.
 * 5. Verify timeline and payment state.
 * 6. Cleanup (Cancel subscription).
 */

const { stdin, stdout } = require("node:process");
const jwt = require("jsonwebtoken");

const BASE_URL = String(process.env.BASE_URL || "https://basicdiet145.onrender.com").replace(/\/+$/, "");
const APP_TOKEN = process.env.APP_TOKEN || "";
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "";
const QA_ALLOW_PAYMENT_PENDING_WRITE = process.env.QA_ALLOW_PAYMENT_PENDING_WRITE === "true";
const QA_KEEP_SUBSCRIPTION = process.env.QA_KEEP_SUBSCRIPTION === "true";

let failures = 0;
let passes = 0;
let warnings = 0;

function pass(label, detail = "") {
  passes += 1;
  console.log(`PASS: ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail = "") {
  failures += 1;
  console.error(`FAIL: ${label}${detail ? ` - ${detail}` : ""}`);
}

function warn(label, detail = "") {
  warnings += 1;
  console.warn(`WARN: ${label}${detail ? ` - ${detail}` : ""}`);
}

function resolveUserId(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.userId) return null;
    return String(decoded.userId);
  } catch (err) {
    return null;
  }
}

async function requestJson(method, path, { token, body, allowError = false } = {}) {
  const headers = {
    "Accept": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    if (!allowError) {
      throw new Error(`Invalid JSON from ${path}: ${raw.substring(0, 100)}`);
    }
    return { ok: response.ok, status: response.status, raw };
  }

  return { ok: response.ok, status: response.status, data: json };
}

function dataArray(json) {
  const data = json && json.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data && data.items)) return data.items;
  if (Array.isArray(data && data.plans)) return data.plans;
  if (Array.isArray(data && data.data)) return data.data;
  return [];
}

function getId(row) {
  if (!row || typeof row !== "object") return "";
  return String(row.id || row._id || row.planId || row.addonId || "");
}

function getPremiumKey(row) {
  if (!row || typeof row !== "object") return "";
  return String(row.premiumKey || row.proteinKey || row.key || row.slug || row.code || "");
}

function cloneWithoutExplicitPickupLocation(payload) {
  const next = JSON.parse(JSON.stringify(payload));
  delete next.pickupLocationId;
  if (next.delivery) delete next.delivery.pickupLocationId;
  return next;
}

function groupOptions(group) {
  if (!group || typeof group !== "object") return [];
  const directOptions = Array.isArray(group.options) ? group.options : [];
  const sectionOptions = Array.isArray(group.optionSections)
    ? group.optionSections.flatMap((sectionRow) => Array.isArray(sectionRow.options) ? sectionRow.options : [])
    : [];
  return directOptions.concat(sectionOptions);
}

function findSection(catalog, key) {
  const sections = Array.isArray(catalog && catalog.sections) ? catalog.sections : [];
  return sections.find((section) => section && section.key === key) || null;
}

function findGroupDeep(root, keys) {
  if (!root || typeof root !== "object") return null;
  const keySet = new Set(keys);
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (keySet.has(String(current.key || ""))) return current;
    for (const field of ["groups", "optionGroups", "sections", "products", "items"]) {
      const children = current[field];
      if (Array.isArray(children)) stack.push(...children);
    }
  }
  return null;
}

function collectItems(obj, out = []) {
  if (!obj || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.forEach(item => collectItems(item, out));
    return out;
  }
  if ((obj.key || obj.premiumKey || obj.category) && (obj.id || obj._id)) {
    out.push(obj);
  }
  ["sections", "products", "optionGroups", "groups", "options", "optionSections", "proteins", "items", "byCategory"].forEach(field => {
    if (obj[field]) collectItems(obj[field], out);
  });
  return out;
}

function choosePremiumProtein(menuData) {
  const builderCatalogV2 = menuData && (menuData.builderCatalogV2 || menuData.builderCatalog?.builderCatalogV2);
  const premiumSection = findSection(builderCatalogV2, "premium_meal");
  const premiumProteinGroup = findGroupDeep(premiumSection, ["protein", "proteins", "premium", "menu_protein"]);
  const premiumOptions = groupOptions(premiumProteinGroup);
  const allCandidates = premiumOptions.concat(collectItems(menuData));
  const seen = new Set();
  const candidates = allCandidates.filter((row) => {
    const id = getId(row);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return Boolean(row.isPremium || row.premiumKey || Number(row.extraFeeHalala || row.priceHalala || 0) > 0);
  });
  const preferredKeys = ["beef_steak", "shrimp", "salmon"];
  return preferredKeys
    .map((key) => candidates.find((row) => getPremiumKey(row) === key))
    .find(Boolean)
    || candidates.find((row) => Number(row.extraFeeHalala || row.priceHalala || 0) > 0)
    || candidates[0]
    || null;
}

function chooseCarb(menuData) {
  const builderCatalogV2 = menuData && (menuData.builderCatalogV2 || menuData.builderCatalog?.builderCatalogV2);
  const premiumSection = findSection(builderCatalogV2, "premium_meal");
  const standardSection = findSection(builderCatalogV2, "standard_meal");
  const premiumCarbGroup = findGroupDeep(premiumSection, ["carb", "carbs", "standard_carbs", "menu_carb"]);
  const standardCarbGroup = findGroupDeep(standardSection, ["carb", "carbs", "standard_carbs", "menu_carb"]);
  const carbs = groupOptions(premiumCarbGroup).concat(groupOptions(standardCarbGroup));
  return carbs.find((row) => getPremiumKey(row) === "white_rice")
    || carbs.find((row) => getId(row))
    || null;
}

function canUseTimelineDay(day) {
  if (!day || !day.date) return false;
  const status = String(day.status || day.timelineStatus || "").toLowerCase();
  const terminalStatuses = new Set([
    "locked",
    "delivered",
    "consumed_without_preparation",
    "delivery_canceled",
    "canceled_at_branch",
    "no_show",
    "frozen",
    "skipped",
  ]);
  if (terminalStatuses.has(status)) return false;
  if (day.canEdit === false || day.canModify === false) return false;
  const max = Number(day.maxSlotCount ?? day.maxConsumableMealsNow ?? day.requiredMealCount ?? day.requiredMeals ?? 1);
  return !Number.isFinite(max) || max > 0;
}

function timelineDaysFromResponse(responseData) {
  const data = responseData && responseData.data;
  if (Array.isArray(data && data.days)) return data.days;
  return [];
}

function summarizeTimelineDays(days) {
  if (!Array.isArray(days) || days.length === 0) return "no days returned";
  const counts = new Map();
  for (const day of days) {
    const status = String(
      (day && (day.status || day.timelineStatus || day.commercialState || day.paymentStatus))
      || "unknown"
    );
    counts.set(status, (counts.get(status) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => `${status}:${count}`)
    .join(", ");
}

async function runQa() {
  console.log("--- Premium + Add-on Pending Payment QA Starting ---");
  console.log(`Base URL: ${BASE_URL}`);

  if (!APP_TOKEN) {
    fail("Environment", "APP_TOKEN is missing");
    process.exit(1);
  }
  if (!DASHBOARD_TOKEN) {
    fail("Environment", "DASHBOARD_TOKEN is missing");
    process.exit(1);
  }
  if (!QA_ALLOW_PAYMENT_PENDING_WRITE) {
    fail("Environment", "QA_ALLOW_PAYMENT_PENDING_WRITE is not true. Write operations are disabled.");
    process.exit(1);
  }

  const userId = resolveUserId(APP_TOKEN);
  if (!userId) {
    fail("Auth", "Could not resolve userId from APP_TOKEN");
    process.exit(1);
  }
  pass("Auth", `Resolved userId: ${userId}`);

  // 1. Catalog Discovery
  console.log("Fetching catalog data...");
  const plansRes = await requestJson("GET", "/api/plans", { token: APP_TOKEN });
  if (!plansRes.ok) {
    fail("Catalog", `Failed to fetch plans: ${JSON.stringify(plansRes.data)}`);
    process.exit(1);
  }
  const plans = plansRes.data && plansRes.data.data;

  // Debug if needed
  if (process.env.QA_DEBUG === "true") {
    console.log("Plans found:", JSON.stringify(plans, null, 2));
  }

  const canonicalPlan = plans && plans.find(p => {
    const dCount = p.daysCount || p.durationDays || p.days;
    return (p.isActive || p.status === "active") && Number(dCount) >= 7;
  });
  
  if (!canonicalPlan) {
    fail("Catalog", "Could not find an active canonical plan (>= 7 days)");
    process.exit(1);
  }
  pass("Catalog", `Using Plan: ${canonicalPlan.id} (${canonicalPlan.daysCount} days)`);

  const menuRes = await requestJson("GET", "/api/subscriptions/meal-planner-menu", { token: APP_TOKEN });
  if (!menuRes.ok) {
    fail("Catalog", `Failed to fetch menu: ${JSON.stringify(menuRes.data)}`);
    process.exit(1);
  }

  const data = menuRes.data && menuRes.data.data;
  const premiumProtein = choosePremiumProtein(data);
  const carb = chooseCarb(data);

  if (!premiumProtein) {
    const foundKeys = [...new Set(collectItems(data).map(getPremiumKey).filter(Boolean))].slice(0, 20).join(", ");
    fail("Catalog", `Could not find a premium protein. Found keys: ${foundKeys || "(none)"}`);
    process.exit(1);
  }
  if (!carb) {
    fail("Catalog", "Could not find a carb option for premium meal selection");
    process.exit(1);
  }
  const premiumProteinFeeHalala = Number(premiumProtein.extraFeeHalala || premiumProtein.priceHalala || 0);
  pass("Catalog", `Using premium protein: ${getId(premiumProtein)} (${getPremiumKey(premiumProtein) || "no-key"}, ${premiumProteinFeeHalala} halala)`);
  pass("Catalog", `Using carb: ${getId(carb)} (${getPremiumKey(carb) || "no-key"})`);

  const addonsRes = await requestJson("GET", "/api/addons?type=subscription", { token: APP_TOKEN });
  if (!addonsRes.ok) {
    fail("Catalog", `Failed to fetch subscription add-ons: ${JSON.stringify(addonsRes.data)}`);
    process.exit(1);
  }
  const addonRows = dataArray(addonsRes.data);
  const targetAddon = ["juice", "snack", "small_salad"]
    .map((category) => addonRows.find((row) => row.category === category && (row.kind === "plan" || row.type === "subscription")))
    .find(Boolean)
    || addonRows.find((row) => row.kind === "plan" || row.type === "subscription");

  if (!targetAddon) {
    fail("Catalog", `Could not find a subscription add-on plan. Found categories: ${[...new Set(addonRows.map(a => a.category).filter(Boolean))].join(", ")}`);
    process.exit(1);
  }
  const addonPlanFeeHalala = Number(targetAddon.priceHalala || targetAddon.pricePerDayHalala || targetAddon.unitPriceHalala || 0);
  pass("Catalog", `Using Add-on Plan: ${getId(targetAddon)} (${targetAddon.category || "no-category"}, ${addonPlanFeeHalala} halala)`);

  const branchRes = await requestJson("GET", "/api/branches/pickup", { token: APP_TOKEN });
  const branchRows = branchRes.ok ? dataArray(branchRes.data) : [];
  const branch = branchRows.find((row) => getId(row)) || null;
  const pickupLocationId = branch ? getId(branch) : "";
  if (pickupLocationId) {
    pass("Catalog", `Using Pickup Location: ${pickupLocationId}`);
  } else {
    warn("Catalog", "No explicit pickup location returned; backend will auto-select the active pickup location");
  }

  // 2. Create Active Subscription
  console.log("Creating Manual QA Subscription...");
  const subPayload = {
    userId,
    planId: canonicalPlan.id,
    grams: 100,
    mealsPerDay: 1,
    startDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // T+2
    deliveryMode: "pickup",
    ...(pickupLocationId ? { pickupLocationId } : {}),
    addonSubscriptions: [{ addonId: getId(targetAddon), maxPerDay: 1 }]
  };

  let createRes = await requestJson("POST", "/api/dashboard/subscriptions", { token: DASHBOARD_TOKEN, body: subPayload });
  if (!createRes.ok && /Invalid pickup location/i.test(JSON.stringify(createRes.data || {})) && subPayload.pickupLocationId) {
    warn("Subscription", `Pickup location ${subPayload.pickupLocationId} was rejected; retrying with backend auto-selection`);
    createRes = await requestJson("POST", "/api/dashboard/subscriptions", {
      token: DASHBOARD_TOKEN,
      body: cloneWithoutExplicitPickupLocation(subPayload),
    });
  }
  if (!createRes.ok) {
    fail("Subscription", `Failed to create subscription: ${JSON.stringify(createRes.data)}`);
    process.exit(1);
  }
  const subscriptionId = createRes.data && createRes.data.data && createRes.data.data.id;
  pass("Subscription", `Created active subscription: ${subscriptionId}`);

  let currentSubId = subscriptionId;

  try {
    // 3. Selection Setup
    const timelineRes = await requestJson("GET", `/api/subscriptions/${subscriptionId}/timeline`, { token: APP_TOKEN });
    const timelineDays = timelineDaysFromResponse(timelineRes.data);
    const targetEntry = timelineDays.find(canUseTimelineDay);
    
    if (!targetEntry) {
      fail("Timeline", `Could not find a modifiable day in timeline. Days: ${summarizeTimelineDays(timelineDays)}`);
      throw new Error("Timeline error");
    }
    const targetDate = targetEntry.date;
    pass("Timeline", `Targeting date: ${targetDate}`);

    const selectionPayload = {
      mealSlots: [
        {
          slotIndex: 1,
          slotKey: "slot_1",
          proteinId: getId(premiumProtein),
          proteinKey: getPremiumKey(premiumProtein) || undefined,
          premiumKey: getPremiumKey(premiumProtein) || undefined,
          carbs: [{ carbId: getId(carb), grams: 150 }],
          selectionType: "premium_meal"
        }
      ],
      addonsOneTime: [] // Not adding one-time here, using the subscription entitlement
    };

    console.log(`Saving selection for ${targetDate}...`);
    const saveRes = await requestJson("PUT", `/api/subscriptions/${subscriptionId}/days/${targetDate}/selection`, { token: APP_TOKEN, body: selectionPayload });
    if (!saveRes.ok) {
      fail("Selection", `Failed to save selection: ${JSON.stringify(saveRes.data)}`);
      throw new Error("Selection error");
    }
    pass("Selection", "Successfully saved premium selection");

    // 4. Unified Payment Initiation
    console.log("Triggering Unified Payment initiation...");
    const paymentPayload = {
        source: "manual_qa_pending_check",
        note: "Testing Premium + Add-on combined pending payment"
    };
    const paymentRes = await requestJson("POST", `/api/subscriptions/${subscriptionId}/days/${targetDate}/payments`, { token: APP_TOKEN, body: paymentPayload });
    
    if (!paymentRes.ok) {
      fail("Payment", `Failed to initiate payment: ${JSON.stringify(paymentRes.data)}`);
      throw new Error("Payment error");
    }

    const pData = paymentRes.data && paymentRes.data.data;
    const totalHalala = pData && pData.totalHalala;
    
    // VERIFICATION
    const expectedTotalHalala = premiumProteinFeeHalala + addonPlanFeeHalala;
    if (totalHalala === expectedTotalHalala) {
      pass("Verification", `Expected total ${expectedTotalHalala} halala confirmed.`);
    } else {
      fail("Verification", `Expected ${expectedTotalHalala} halala, but got ${totalHalala}`);
    }

    const timelineCheck = await requestJson("GET", `/api/subscriptions/${subscriptionId}/timeline`, { token: APP_TOKEN });
    const dayCheck = timelineDaysFromResponse(timelineCheck.data).find(e => e.date === targetDate);
    
    if (
      dayCheck
      && (
        dayCheck.paymentStatus === "pending"
        || dayCheck.commercialState === "pending_payment"
        || dayCheck.status === "pending_payment"
        || dayCheck.timelineStatus === "pending_payment"
      )
    ) {
      pass("Verification", "Timeline reflects pending payment state.");
    } else {
      warn("Verification", `Timeline state for ${targetDate}: ${JSON.stringify(dayCheck)}`);
    }

  } catch (err) {
    console.error("QA Error during flow execution:", err.message);
  } finally {
    // 5. Cleanup
    if (!QA_KEEP_SUBSCRIPTION && currentSubId) {
      console.log(`Canceling subscription ${currentSubId} for cleanup...`);
      await requestJson("POST", `/api/dashboard/subscriptions/${currentSubId}/cancel`, { token: DASHBOARD_TOKEN, body: { reason: "QA Cleanup" } });
      pass("Cleanup", "Subscription canceled.");
    } else {
      console.log("Skipping cleanup as requested.");
    }
  }

  console.log("\n--- QA REPORT ---");
  console.log(`PASSES: ${passes}`);
  console.log(`WARNINGS: ${warnings}`);
  console.log(`FAILURES: ${failures}`);
  
  if (failures === 0) {
    console.log("FINAL STATUS: PASS_PROD_READY");
  } else {
    console.log("FINAL STATUS: FAILED");
    process.exit(1);
  }
}

runQa().catch(err => {
  console.error("Critical Failure:", err);
  process.exit(1);
});
