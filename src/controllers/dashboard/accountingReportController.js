"use strict";

const accountingDailyReportService = require("../../services/dashboard/accountingDailyReportService");
const errorResponse = require("../../utils/errorResponse");

function handleAccountingError(res, err) {
  if (err instanceof accountingDailyReportService.AccountingReportError) {
    return errorResponse(res, err.status, err.code, err.message);
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
      return errorResponse(res, 400, "UNSUPPORTED_EXPORT_FORMAT", "Only csv export is currently supported");
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
