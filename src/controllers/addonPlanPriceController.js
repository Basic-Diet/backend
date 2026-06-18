const AddonPlanPrice = require("../models/AddonPlanPrice");
const Addon = require("../models/Addon");
const Plan = require("../models/Plan");
const validateObjectId = require("../utils/validateObjectId");
const errorResponse = require("../utils/errorResponse");

const SYSTEM_CURRENCY = "SAR";

function formatAddonPlanPrice(row) {
  const addon = row.addonPlanId || {};
  const basePlan = row.basePlanId || {};

  const daysCount = basePlan.daysCount || 0;
  let mealsCount = daysCount * 2;
  if (basePlan.gramsOptions && basePlan.gramsOptions.length > 0) {
    const gramsOpt = basePlan.gramsOptions.find((g) => g.grams === 100) || basePlan.gramsOptions[0];
    if (gramsOpt && gramsOpt.mealsOptions && gramsOpt.mealsOptions.length > 0) {
      const mealOpt = gramsOpt.mealsOptions.find((m) => m.mealsPerDay === 2) || gramsOpt.mealsOptions[0];
      if (mealOpt) {
        mealsCount = daysCount * mealOpt.mealsPerDay;
      }
    }
  }

  return {
    id: String(row._id),
    _id: row._id,
    addonPlanId: addon._id || row.addonPlanId,
    addonPlanName: addon.name || { ar: "", en: "" },
    category: addon.category || "",
    basePlanId: basePlan._id || row.basePlanId,
    basePlanName: basePlan.name || { ar: "", en: "" },
    daysCount,
    mealsCount,
    priceHalala: row.priceHalala,
    priceSar: row.priceHalala / 100,
    priceLabel: `${row.priceHalala / 100} SAR`,
    currency: row.currency || SYSTEM_CURRENCY,
    isActive: row.isActive !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listAddonPrices(req, res) {
  try {
    const { includeInternal } = req.query || {};
    const matchQuery = includeInternal === "true" ? {} : Plan.getSellableQuery();

    const rows = await AddonPlanPrice.find()
      .populate("addonPlanId")
      .populate({ path: "basePlanId", match: matchQuery })
      .sort({ createdAt: -1 })
      .lean();
      
    const filteredRows = rows.filter(row => row.basePlanId != null);
    const data = filteredRows.map(formatAddonPlanPrice);
    return res.status(200).json({ status: true, data });
  } catch (err) {
    throw err;
  }
}

async function getAddonPrice(req, res) {
  const { id } = req.params;
  try {
    validateObjectId(id, "id");
  } catch (err) {
    return errorResponse(res, err.status, err.code, err.message);
  }

  try {
    const row = await AddonPlanPrice.findById(id)
      .populate("addonPlanId")
      .populate("basePlanId")
      .lean();
    if (!row) {
      return errorResponse(res, 404, "NOT_FOUND", "Addon plan price row not found");
    }
    return res.status(200).json({ status: true, data: formatAddonPlanPrice(row) });
  } catch (err) {
    throw err;
  }
}

async function createAddonPrice(req, res) {
  const { addonPlanId, basePlanId, priceHalala, currency, isActive = true } = req.body || {};

  try {
    validateObjectId(addonPlanId, "addonPlanId");
    validateObjectId(basePlanId, "basePlanId");
  } catch (err) {
    return errorResponse(res, err.status, err.code, err.message);
  }

  const parsedPrice = Number(priceHalala);
  if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
    return errorResponse(res, 400, "INVALID", "priceHalala must be an integer >= 0");
  }

  if (currency && currency !== SYSTEM_CURRENCY) {
    return errorResponse(res, 400, "INVALID", `currency must be ${SYSTEM_CURRENCY}`);
  }

  try {
    const addon = await Addon.findById(addonPlanId).lean();
    if (!addon) {
      return errorResponse(res, 404, "NOT_FOUND", "Addon plan not found");
    }
    if (addon.kind !== "plan") {
      return errorResponse(res, 400, "INVALID", "Addon is not of kind 'plan'");
    }

    const plan = await Plan.findById(basePlanId).lean();
    if (!plan) {
      return errorResponse(res, 404, "NOT_FOUND", "Base plan not found");
    }

    if (isActive) {
      const existingActive = await AddonPlanPrice.findOne({
        addonPlanId,
        basePlanId,
        isActive: true,
      }).lean();
      if (existingActive) {
        return errorResponse(res, 400, "DUPLICATE_ACTIVE_PRICE", "An active price matrix row already exists for this combination.");
      }
    }

    const newRow = await AddonPlanPrice.create({
      addonPlanId,
      basePlanId,
      priceHalala: parsedPrice,
      currency: currency || SYSTEM_CURRENCY,
      isActive: !!isActive,
    });

    const populated = await AddonPlanPrice.findById(newRow._id)
      .populate("addonPlanId")
      .populate("basePlanId")
      .lean();

    return res.status(201).json({ status: true, data: formatAddonPlanPrice(populated) });
  } catch (err) {
    throw err;
  }
}

async function updateAddonPrice(req, res) {
  const { id } = req.params;
  const { addonPlanId, basePlanId, priceHalala, currency, isActive } = req.body || {};

  try {
    validateObjectId(id, "id");
    if (addonPlanId) validateObjectId(addonPlanId, "addonPlanId");
    if (basePlanId) validateObjectId(basePlanId, "basePlanId");
  } catch (err) {
    return errorResponse(res, err.status, err.code, err.message);
  }

  try {
    const row = await AddonPlanPrice.findById(id);
    if (!row) {
      return errorResponse(res, 404, "NOT_FOUND", "Addon plan price row not found");
    }

    const targetAddonId = addonPlanId || row.addonPlanId;
    const targetBasePlanId = basePlanId || row.basePlanId;
    const targetIsActive = isActive !== undefined ? !!isActive : row.isActive;

    if (addonPlanId) {
      const addon = await Addon.findById(addonPlanId).lean();
      if (!addon) {
        return errorResponse(res, 404, "NOT_FOUND", "Addon plan not found");
      }
      if (addon.kind !== "plan") {
        return errorResponse(res, 400, "INVALID", "Addon is not of kind 'plan'");
      }
    }

    if (basePlanId) {
      const plan = await Plan.findById(basePlanId).lean();
      if (!plan) {
        return errorResponse(res, 404, "NOT_FOUND", "Base plan not found");
      }
    }

    if (priceHalala !== undefined) {
      const parsedPrice = Number(priceHalala);
      if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
        return errorResponse(res, 400, "INVALID", "priceHalala must be an integer >= 0");
      }
      row.priceHalala = parsedPrice;
    }

    if (currency) {
      if (currency !== SYSTEM_CURRENCY) {
        return errorResponse(res, 400, "INVALID", `currency must be ${SYSTEM_CURRENCY}`);
      }
      row.currency = currency;
    }

    if (targetIsActive) {
      const existingActive = await AddonPlanPrice.findOne({
        addonPlanId: targetAddonId,
        basePlanId: targetBasePlanId,
        isActive: true,
        _id: { $ne: id },
      }).lean();
      if (existingActive) {
        return errorResponse(res, 400, "DUPLICATE_ACTIVE_PRICE", "An active price matrix row already exists for this combination.");
      }
    }

    row.addonPlanId = targetAddonId;
    row.basePlanId = targetBasePlanId;
    row.isActive = targetIsActive;

    await row.save();

    const populated = await AddonPlanPrice.findById(row._id)
      .populate("addonPlanId")
      .populate("basePlanId")
      .lean();

    return res.status(200).json({ status: true, data: formatAddonPlanPrice(populated) });
  } catch (err) {
    throw err;
  }
}

async function deleteAddonPrice(req, res) {
  const { id } = req.params;
  try {
    validateObjectId(id, "id");
  } catch (err) {
    return errorResponse(res, err.status, err.code, err.message);
  }

  try {
    const row = await AddonPlanPrice.findByIdAndDelete(id);
    if (!row) {
      return errorResponse(res, 404, "NOT_FOUND", "Addon plan price row not found");
    }
    return res.status(200).json({ status: true, message: "Addon plan price row deleted successfully" });
  } catch (err) {
    throw err;
  }
}

async function toggleAddonPriceActive(req, res) {
  const { id } = req.params;
  try {
    validateObjectId(id, "id");
  } catch (err) {
    return errorResponse(res, err.status, err.code, err.message);
  }

  try {
    const row = await AddonPlanPrice.findById(id);
    if (!row) {
      return errorResponse(res, 404, "NOT_FOUND", "Addon plan price row not found");
    }

    const nextActive = !row.isActive;
    if (nextActive) {
      const existingActive = await AddonPlanPrice.findOne({
        addonPlanId: row.addonPlanId,
        basePlanId: row.basePlanId,
        isActive: true,
        _id: { $ne: id },
      }).lean();
      if (existingActive) {
        return errorResponse(res, 400, "DUPLICATE_ACTIVE_PRICE", "An active price matrix row already exists for this combination.");
      }
    }

    row.isActive = nextActive;
    await row.save();

    return res.status(200).json({ status: true, data: { id: row._id, isActive: row.isActive } });
  } catch (err) {
    throw err;
  }
}

module.exports = {
  listAddonPrices,
  getAddonPrice,
  createAddonPrice,
  updateAddonPrice,
  deleteAddonPrice,
  toggleAddonPriceActive,
};
