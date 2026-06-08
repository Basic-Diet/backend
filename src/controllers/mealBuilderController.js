const mealBuilderService = require("../services/subscription/mealBuilderConfigService");
const errorResponse = require("../utils/errorResponse");
const { getRequestLang } = require("../utils/i18n");

async function getPublishedMealBuilder(req, res) {
  try {
    const contract = await mealBuilderService.buildPublishedContract({ lang: getRequestLang(req) });
    const { membership: _membership, ...payload } = contract;
    return res.status(200).json({ status: true, data: payload });
  } catch (err) {
    if (err && err.status && err.code) {
      return errorResponse(res, err.status, err.code, err.message, err.details);
    }
    return errorResponse(res, 500, "MEAL_BUILDER_INTERNAL_ERROR", "Unexpected Meal Builder error");
  }
}

module.exports = {
  getPublishedMealBuilder,
};
