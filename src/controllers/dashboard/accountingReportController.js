"use strict";

const accountingDailyReportService = require("../../services/dashboard/accountingDailyReportService");

function handleAccountingError(res, err) {
  if (err instanceof accountingDailyReportService.AccountingReportError) {
    const messageArByCode = {
      INVALID_DATE: "صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD",
      INVALID_FULFILLMENT_METHOD: "طريقة التنفيذ غير صحيحة. استخدم all أو pickup أو delivery",
      INVALID_INCLUDE_DETAILS: "قيمة عرض التفاصيل غير صحيحة. استخدم true أو false",
      UNSUPPORTED_EXPORT_FORMAT: "صيغة التصدير غير مدعومة. الصيغة المتاحة هي csv",
    };
    const messageAr = messageArByCode[err.code] || "تعذر إنشاء تقرير المحاسبة";
    return res.status(err.status).json({
      ok: false,
      status: false,
      message: err.message,
      messageAr,
      error: { code: err.code, message: err.message, messageAr },
    });
  }
  throw err;
}

async function getDailyReport(req, res) {
  try {
    const data = await accountingDailyReportService.buildDailyReport({
      date: req.query.date,
      fulfillmentMethod: req.query.fulfillmentMethod,
      includeDetails: req.query.includeDetails,
      actorId: req.dashboardUserId,
      actorRole: req.dashboardUserRole,
    });
    return res.status(200).json({ status: true, data });
  } catch (err) {
    return handleAccountingError(res, err);
  }
}

async function exportDailyReport(req, res) {
  try {
    const format = String(req.query.format || "csv").trim().toLowerCase();
    if (format !== "csv") {
      throw new accountingDailyReportService.AccountingReportError(
        "UNSUPPORTED_EXPORT_FORMAT",
        "Only csv export is currently supported",
        400
      );
    }

    const data = await accountingDailyReportService.buildDailyReport({
      date: req.query.date,
      fulfillmentMethod: req.query.fulfillmentMethod,
      includeDetails: true,
      actorId: req.dashboardUserId,
      actorRole: req.dashboardUserRole,
    });
    const csv = accountingDailyReportService.reportToCsv(data);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="daily-accountant-report-${data.businessDate}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    return handleAccountingError(res, err);
  }
}

module.exports = {
  getDailyReport,
  exportDailyReport,
};
