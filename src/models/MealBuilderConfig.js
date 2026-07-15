const mongoose = require("mongoose");

const LocalizedStringSchema = new mongoose.Schema(
  {
    ar: { type: String, default: "" },
    en: { type: String, default: "" },
  },
  { _id: false }
);

const MealBuilderSectionSchema = new mongoose.Schema(
  {
    key: { type: String, default: "", trim: true, index: true },
    sectionType: {
      type: String,
      enum: ["option_group", "product_category", "product_list"],
      required: true,
    },
    sourceKind: {
      type: String,
      enum: ["", "visual_family", "configurable_product", "product_list", "premium_visual"],
      default: "",
      trim: true,
    },
    titleOverride: { type: LocalizedStringSchema, default: () => ({}) },
    productContextId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuProduct", default: null },
    sourceGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuOptionGroup", default: null },
    sourceCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuCategory", default: null },
    selectedOptionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuOption" }],
    selectedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuProduct" }],
    includeMode: { type: String, enum: ["all", "selected"], default: "selected" },
    selectionType: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    required: { type: Boolean, default: false },
    minSelections: { type: Number, min: 0, default: 0 },
    maxSelections: { type: Number, min: 0, default: null },
    multiSelect: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    availableFor: {
      type: [String],
      enum: ["subscription"],
      default: ["subscription"],
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    rules: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: true }
);

const MealBuilderConfigSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      required: true,
      index: true,
    },
    isCurrent: { type: Boolean, default: false, index: true },
    contractVersion: { type: String, default: "subscription_meal_builder.v1" },
    versionNumber: { type: Number, min: 0, default: 0 },
    basedOnPublishedVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "MealBuilderConfig", default: null },
    revisionHash: { type: String, default: "", index: true },
    source: {
      type: String,
      enum: ["dashboard", "bootstrap"],
      default: "dashboard",
      index: true,
    },
    createdBySystem: { type: Boolean, default: false, index: true },
    bootstrapKey: { type: String, default: "", trim: true, index: true },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "DashboardUser", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "DashboardUser", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "DashboardUser", default: null },
    notes: { type: String, default: "" },
    sections: { type: [MealBuilderSectionSchema], default: [] },
  },
  { timestamps: true }
);

MealBuilderConfigSchema.index({ status: 1, isCurrent: 1, updatedAt: -1 });
MealBuilderConfigSchema.index({ "sections.productContextId": 1 });
MealBuilderConfigSchema.index({ "sections.sourceGroupId": 1 });
MealBuilderConfigSchema.index({ "sections.sourceCategoryId": 1 });
MealBuilderConfigSchema.index({ source: 1, bootstrapKey: 1, status: 1, isCurrent: 1 });

module.exports = mongoose.model("MealBuilderConfig", MealBuilderConfigSchema);
