const { Router } = require("express");
const controller = require("../controllers/dashboardStaffUserController");
const asyncHandler = require("../middleware/asyncHandler");
const { dashboardAuthMiddleware, dashboardRoleMiddleware } = require("../middleware/dashboardAuth");

const router = Router();

router.use(dashboardAuthMiddleware);
router.use(dashboardRoleMiddleware(["superadmin"]));

router.get("/", asyncHandler(controller.listStaffUsers));
router.post("/", asyncHandler(controller.createStaffUser));
router.patch("/:id", asyncHandler(controller.updateStaffUser));
router.post("/:id/reset-password", asyncHandler(controller.resetStaffPassword));

module.exports = router;
