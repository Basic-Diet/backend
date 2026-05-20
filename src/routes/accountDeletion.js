const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const optionalAuthMiddleware = require("../middleware/optionalAuth");
const { accountDeletionLimiter } = require("../middleware/rateLimit");
const { requestAccountDeletion } = require("../controllers/accountDeletionController");

const router = Router();

router.post(
  "/request",
  accountDeletionLimiter,
  optionalAuthMiddleware,
  asyncHandler(requestAccountDeletion)
);

module.exports = router;
