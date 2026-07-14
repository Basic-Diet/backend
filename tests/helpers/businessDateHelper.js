"use strict";

const dateUtils = require("../../src/utils/date");

function getTestBusinessDate(now = new Date()) {
  return dateUtils.getTodayKSADate(now);
}

function getFutureBusinessDate(days = 1, now = new Date()) {
  return dateUtils.addDaysToKSADateString(getTestBusinessDate(now), days);
}

function getPastBusinessDate(days = 1, now = new Date()) {
  return dateUtils.addDaysToKSADateString(getTestBusinessDate(now), -Math.abs(days));
}

function toBusinessDateString(value) {
  if (typeof value === "string") return value;
  return dateUtils.toKSADateString(value);
}

module.exports = {
  getTestBusinessDate,
  getFutureBusinessDate,
  getPastBusinessDate,
  toBusinessDateString,
};
