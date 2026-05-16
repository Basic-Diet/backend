"use strict";

const { Router } = require("express");
const controller = require("../controllers/dashboard/subscriptionManualDeductionController");
const asyncHandler = require("../middleware/asyncHandler");
const { dashboardAuthMiddleware, dashboardRoleMiddleware } = require("../middleware/dashboardAuth");

const router = Router();

router.get(
  "/search",
  dashboardAuthMiddleware,
  dashboardRoleMiddleware(["admin"]),
  asyncHandler(controller.searchByPhone)
);

router.post(
  "/:subscriptionId/manual-deduction",
  dashboardAuthMiddleware,
  dashboardRoleMiddleware(["admin"]),
  asyncHandler(controller.manualDeduction)
);

module.exports = router;
