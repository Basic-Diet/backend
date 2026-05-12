const opsTransitionService = require("../../services/dashboard/opsTransitionService");
const opsActionPolicy = require("../../services/dashboard/opsActionPolicy");
const opsReadService = require("../../services/dashboard/opsReadService");
const SubscriptionDay = require("../../models/SubscriptionDay");
const SubscriptionPickupRequest = require("../../models/SubscriptionPickupRequest");
const Subscription = require("../../models/Subscription");
const { executeDashboardOrderAction } = require("../../services/orders/orderDashboardService");
const errorResponse = require("../../utils/errorResponse");
const { getRequestLang } = require("../../utils/i18n");
// Settlement on read is DISABLED — see pastSubscriptionDaySettlementService.js

/**
 * Controller for the Unified Actions API.
 * POST /api/dashboard/ops/actions/:action
 */

async function handleAction(req, res) {
  const lang = getRequestLang(req);
  const role = req.userRole;

  try {
    const { action } = req.params;
    const { entityId, payload = {} } = req.body;
    let rawEntityType = req.body.entityType;
    if (req.body.source === "one_time_order") {
      rawEntityType = "order";
    }
    const entityType = rawEntityType === "subscription_day" || rawEntityType === "pickup_day"
      ? "subscription"
      : rawEntityType;

    if (!entityId || !rawEntityType) {
      return errorResponse(res, 400, "INVALID_REQUEST", "entityId and entityType are required");
    }
    if (!["subscription", "subscription_day", "pickup_day", "subscription_pickup_request", "order"].includes(rawEntityType)) {
      return errorResponse(res, 400, "INVALID_ENTITY_TYPE", "entityType must be subscription_day, subscription, pickup_day, subscription_pickup_request, or order");
    }

    if (entityType === "order") {
      try {
        const data = await executeDashboardOrderAction({
          orderId: entityId,
          action,
          actor: { userId: req.dashboardUserId || req.userId, role },
          payload,
        });
        return res.status(200).json({ status: true, data });
      } catch (err) {
        if (err.status || err.code) {
          return errorResponse(res, err.status || 500, err.code || "INTERNAL", err.message, err.details);
        }
        throw err;
      }
    } else if (entityType === "subscription_pickup_request") {
      const doc = await SubscriptionPickupRequest.findById(entityId).lean();
      if (!doc) {
        return errorResponse(res, 404, "NOT_FOUND", "Entity not found");
      }
      const validation = opsActionPolicy.validateAction({
        entityType,
        status: doc.status,
        mode: "pickup",
        role,
        actionId: action,
      });

      if (!validation.allowed) {
        return errorResponse(res, 409, validation.reason, `Action ${action} is not allowed in current state`);
      }

      await opsTransitionService.executeAction(action, {
        entityId,
        entityType,
        userId: req.dashboardUserId || req.userId,
        role,
        payload,
      });
    } else {
      // 1. Fetch current state for validation
      const Model = SubscriptionDay;
      // Settlement on read intentionally removed — meals are not consumed by date passage.
      const doc = await Model.findById(entityId).lean();
      if (!doc) {
        return errorResponse(res, 404, "NOT_FOUND", "Entity not found");
      }

      // 2. Validate action using Policy Engine
      const sub = await Subscription.findById(doc.subscriptionId).select("deliveryMode").lean();
      const mode = sub && sub.deliveryMode === "pickup" ? "pickup" : "delivery";
      
      const validation = opsActionPolicy.validateAction({
        entityType,
        status: doc.status,
        mode,
        role,
        actionId: action,
      });

      if (!validation.allowed) {
        return errorResponse(res, 409, validation.reason, `Action ${action} is not allowed in current state`);
      }

      // 3. Execute Transition
      await opsTransitionService.executeAction(action, {
        entityId,
        entityType,
        userId: req.dashboardUserId || req.userId,
        role,
        payload,
      });
    }

    // 4. Return Updated Unified DTO
    const updatedDTO = await opsReadService.getEnrichedDTO({
      entityId,
      entityType,
      role,
      lang,
    });

    return res.status(200).json({
      status: true,
      data: updatedDTO,
    });
  } catch (err) {
    if (err.message === "INVALID_PICKUP_CODE") {
      return errorResponse(res, 400, "INVALID_PICKUP_CODE", "The provided pickup code is incorrect");
    }
    if (err.message === "INVALID_STATE_TRANSITION") {
      return errorResponse(res, 409, "INVALID_STATE_TRANSITION", "This transition is not allowed");
    }
    if (err.message === "PICKUP_PREPARE_REQUIRED") {
      return errorResponse(res, 409, "PICKUP_PREPARE_REQUIRED", "Pickup preparation requires an explicit client request");
    }
    if (err.status || err.code) {
      return errorResponse(res, err.status || 500, err.code || "INTERNAL", err.message, err.details);
    }
    
    console.error("Dashboard Action Error:", err);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Action execution failed", { detail: err.message });
  }
}

module.exports = {
  handleAction,
};
