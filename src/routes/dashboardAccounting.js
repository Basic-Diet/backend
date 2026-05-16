"use strict";

const { Router } = require("express");
const controller = require("../controllers/dashboard/accountingReportController");
const asyncHandler = require("../middleware/asyncHandler");
const { dashboardAuthMiddleware, dashboardRoleMiddleware } = require("../middleware/dashboardAuth");

const router = Router();

router.get(
  "/daily-report",
  dashboardAuthMiddleware,
  dashboardRoleMiddleware(["admin"]),
  asyncHandler(controller.getDailyReport)
);

router.get(
  "/daily-report/export",
  dashboardAuthMiddleware,
  dashboardRoleMiddleware(["admin"]),
  asyncHandler(controller.exportDailyReport)
);

module.exports = router;
