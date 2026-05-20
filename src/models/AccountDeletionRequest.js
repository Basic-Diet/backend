const mongoose = require("mongoose");

const AccountDeletionRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    reason: { type: String, default: null, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "completed", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

AccountDeletionRequestSchema.index({ email: 1, status: 1, requestedAt: -1 });
AccountDeletionRequestSchema.index({ userId: 1, status: 1, requestedAt: -1 });

module.exports = mongoose.model("AccountDeletionRequest", AccountDeletionRequestSchema);
