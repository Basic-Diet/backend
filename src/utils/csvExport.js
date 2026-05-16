"use strict";

function escapeCsvValue(value) {
  if (value === undefined || value === null) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowToCsv(row) {
  return row.map(escapeCsvValue).join(",");
}

function buildSectionedCsv(sections) {
  const lines = [];
  for (const section of sections) {
    if (!section || !section.title) continue;
    if (lines.length > 1) lines.push("");
    lines.push(rowToCsv([section.title]));
    if (Array.isArray(section.headers) && section.headers.length) {
      lines.push(rowToCsv(section.headers));
    }
    for (const row of section.rows || []) {
      lines.push(rowToCsv(row));
    }
  }
  return `\uFEFF${lines.join("\n")}`;
}

module.exports = {
  buildSectionedCsv,
  escapeCsvValue,
};
