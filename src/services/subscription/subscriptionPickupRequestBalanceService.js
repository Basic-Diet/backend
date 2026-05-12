"use strict";

const Subscription = require("../../models/Subscription");
const SubscriptionPickupRequest = require("../../models/SubscriptionPickupRequest");

function createServiceError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function assertPositiveMealCount(mealCount) {
  if (!Number.isInteger(mealCount) || mealCount <= 0) {
    throw createServiceError("INVALID_MEAL_COUNT", "mealCount must be a positive integer", 400);
  }
}

function withOptionalSession(options, session) {
  return session ? { ...options, session } : options;
}

async function findPickupRequestOrThrow(pickupRequestId, session) {
  if (!pickupRequestId) {
    throw createServiceError("INVALID_ARGUMENTS", "pickupRequestId is required", 400);
  }

  const query = SubscriptionPickupRequest.findById(pickupRequestId);
  if (session) query.session(session);
  const pickupRequest = await query;
  if (!pickupRequest) {
    throw createServiceError("PICKUP_REQUEST_NOT_FOUND", "Pickup request not found", 404);
  }
  return pickupRequest;
}

async function refundReservedDecrement({ subscriptionId, mealCount, session }) {
  await Subscription.updateOne(
    { _id: subscriptionId },
    { $inc: { remainingMeals: mealCount } },
    withOptionalSession({}, session)
  );
}

async function reserveSubscriptionMealsForPickupRequest({
  subscriptionId,
  pickupRequestId,
  mealCount,
  session = null,
} = {}) {
  if (!subscriptionId) {
    throw createServiceError("INVALID_ARGUMENTS", "subscriptionId is required", 400);
  }

  const pickupRequest = await findPickupRequestOrThrow(pickupRequestId, session);
  const requestMealCount = Number(pickupRequest.mealCount || 0);
  const resolvedMealCount = mealCount == null ? requestMealCount : Number(mealCount);
  assertPositiveMealCount(resolvedMealCount);

  if (requestMealCount !== resolvedMealCount) {
    throw createServiceError("MEAL_COUNT_MISMATCH", "mealCount does not match pickup request mealCount", 400);
  }

  if (String(pickupRequest.subscriptionId) !== String(subscriptionId)) {
    throw createServiceError("SUBSCRIPTION_MISMATCH", "Pickup request does not belong to subscription", 400);
  }

  if (pickupRequest.creditsReserved) {
    return {
      reserved: false,
      alreadyReserved: true,
      pickupRequest,
      mealCount: resolvedMealCount,
    };
  }

  const reserveResult = await Subscription.updateOne(
    { _id: subscriptionId, remainingMeals: { $gte: resolvedMealCount } },
    { $inc: { remainingMeals: -resolvedMealCount } },
    withOptionalSession({}, session)
  );

  if (!reserveResult.modifiedCount) {
    throw createServiceError("INSUFFICIENT_CREDITS", "رصيد وجباتك غير كافٍ", 422);
  }

  const now = new Date();
  const updatedPickupRequest = await SubscriptionPickupRequest.findOneAndUpdate(
    { _id: pickupRequestId, creditsReserved: { $ne: true } },
    {
      $set: {
        creditsReserved: true,
        creditsReservedAt: now,
      },
    },
    withOptionalSession({ new: true }, session)
  );

  if (!updatedPickupRequest) {
    await refundReservedDecrement({ subscriptionId, mealCount: resolvedMealCount, session });
    const currentPickupRequest = await findPickupRequestOrThrow(pickupRequestId, session);
    return {
      reserved: false,
      alreadyReserved: Boolean(currentPickupRequest.creditsReserved),
      pickupRequest: currentPickupRequest,
      mealCount: resolvedMealCount,
    };
  }

  return {
    reserved: true,
    alreadyReserved: false,
    pickupRequest: updatedPickupRequest,
    mealCount: resolvedMealCount,
  };
}

async function consumeReservedPickupMeals({
  pickupRequestId,
  session = null,
} = {}) {
  const now = new Date();
  const updatedPickupRequest = await SubscriptionPickupRequest.findOneAndUpdate(
    {
      _id: pickupRequestId,
      creditsReserved: true,
      creditsConsumedAt: null,
      creditsReleasedAt: null,
    },
    { $set: { creditsConsumedAt: now } },
    withOptionalSession({ new: true }, session)
  );

  if (updatedPickupRequest) {
    return {
      consumed: true,
      alreadyConsumed: false,
      pickupRequest: updatedPickupRequest,
      mealCount: Number(updatedPickupRequest.mealCount || 0),
    };
  }

  const pickupRequest = await findPickupRequestOrThrow(pickupRequestId, session);
  if (pickupRequest.creditsConsumedAt) {
    return {
      consumed: false,
      alreadyConsumed: true,
      pickupRequest,
      mealCount: Number(pickupRequest.mealCount || 0),
    };
  }
  if (pickupRequest.creditsReleasedAt) {
    throw createServiceError("CREDITS_RELEASED", "Reserved pickup meals were already released", 409);
  }
  if (!pickupRequest.creditsReserved) {
    throw createServiceError("CREDITS_NOT_RESERVED", "Pickup request meals are not reserved", 409);
  }

  throw createServiceError("INVALID_PICKUP_REQUEST_STATE", "Pickup request cannot be consumed", 409);
}

async function releaseReservedPickupMeals({
  subscriptionId,
  pickupRequestId,
  session = null,
} = {}) {
  if (!subscriptionId) {
    throw createServiceError("INVALID_ARGUMENTS", "subscriptionId is required", 400);
  }

  const now = new Date();
  const releasedPickupRequest = await SubscriptionPickupRequest.findOneAndUpdate(
    {
      _id: pickupRequestId,
      subscriptionId,
      creditsReserved: true,
      creditsConsumedAt: null,
      creditsReleasedAt: null,
    },
    { $set: { creditsReleasedAt: now } },
    withOptionalSession({ new: true }, session)
  );

  if (!releasedPickupRequest) {
    const pickupRequest = await findPickupRequestOrThrow(pickupRequestId, session);
    if (String(pickupRequest.subscriptionId) !== String(subscriptionId)) {
      throw createServiceError("SUBSCRIPTION_MISMATCH", "Pickup request does not belong to subscription", 400);
    }
    if (pickupRequest.creditsReleasedAt) {
      return {
        released: false,
        alreadyReleased: true,
        pickupRequest,
        mealCount: Number(pickupRequest.mealCount || 0),
      };
    }
    if (pickupRequest.creditsConsumedAt) {
      throw createServiceError("CREDITS_CONSUMED", "Reserved pickup meals were already consumed", 409);
    }
    if (!pickupRequest.creditsReserved) {
      throw createServiceError("CREDITS_NOT_RESERVED", "Pickup request meals are not reserved", 409);
    }
    throw createServiceError("INVALID_PICKUP_REQUEST_STATE", "Pickup request cannot be released", 409);
  }

  const mealCount = Number(releasedPickupRequest.mealCount || 0);
  assertPositiveMealCount(mealCount);

  await Subscription.updateOne(
    { _id: subscriptionId },
    { $inc: { remainingMeals: mealCount } },
    withOptionalSession({}, session)
  );

  return {
    released: true,
    alreadyReleased: false,
    pickupRequest: releasedPickupRequest,
    mealCount,
  };
}

module.exports = {
  consumeReservedPickupMeals,
  releaseReservedPickupMeals,
  reserveSubscriptionMealsForPickupRequest,
};
