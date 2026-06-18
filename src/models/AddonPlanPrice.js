const mongoose = require("mongoose");

const AddonPlanPriceSchema = new mongoose.Schema(
  {
    addonPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Addon",
      required: true,
      index: true,
    },
    basePlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    priceHalala: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "SAR",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index to prevent duplicate active prices for the same addon plan + base plan combination
AddonPlanPriceSchema.index(
  { addonPlanId: 1, basePlanId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "unique_active_addon_base_price",
  }
);

module.exports = mongoose.model("AddonPlanPrice", AddonPlanPriceSchema);
