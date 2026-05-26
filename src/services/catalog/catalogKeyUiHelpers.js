const crypto = require("crypto");

const CARD_VARIANTS = Object.freeze(["standard", "premium", "large_salad", "addon"]);
const DEFAULT_CARD_VARIANT = "standard";
const GROUP_DISPLAY_STYLES = Object.freeze(["chips", "radio_cards", "checkbox_grid", "dropdown", "stepper"]);
const DEFAULT_GROUP_DISPLAY_STYLE = "chips";
const SNAKE_CASE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

function isAllowedCardVariant(value) {
  return CARD_VARIANTS.includes(String(value || "").trim());
}

function sanitizeCardVariant(value) {
  const normalized = String(value || "").trim();
  return isAllowedCardVariant(normalized) ? normalized : DEFAULT_CARD_VARIANT;
}

function isAllowedGroupDisplayStyle(value) {
  return GROUP_DISPLAY_STYLES.includes(String(value || "").trim());
}

function sanitizeGroupDisplayStyle(value) {
  const normalized = String(value || "").trim();
  return isAllowedGroupDisplayStyle(normalized) ? normalized : DEFAULT_GROUP_DISPLAY_STYLE;
}

function sanitizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUiMetadata(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    cardVariant: sanitizeCardVariant(source.cardVariant),
  };
}

function normalizeProductUiMetadata(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    cardVariant: sanitizeCardVariant(source.cardVariant),
    badge: sanitizeString(source.badge),
    ctaLabel: sanitizeString(source.ctaLabel),
    imageRatio: sanitizeString(source.imageRatio) || "square",
  };
}

function normalizeGroupUiMetadata(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    displayStyle: sanitizeGroupDisplayStyle(source.displayStyle),
  };
}

function inferCardVariantFromKey(key) {
  const normalized = String(key || "").trim().toLowerCase();
  if (normalized === "premium") return "premium";
  if (normalized === "large_salad") return "large_salad";
  if (["addon", "addons", "snack", "juice", "small_salad"].includes(normalized)) return "addon";
  return DEFAULT_CARD_VARIANT;
}

function randomSuffix(length = 6) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function pickNameSource(name) {
  if (typeof name === "string") return name;
  if (name && typeof name === "object" && !Array.isArray(name)) {
    return name.en || name.ar || "";
  }
  return "";
}

function slugifyKeySource(value) {
  const source = pickNameSource(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return SNAKE_CASE_PATTERN.test(source) ? source : "";
}

async function generateUniqueKey({
  name,
  fallbackPrefix,
  exists,
}) {
  if (typeof exists !== "function") {
    throw new Error("generateUniqueKey requires an exists function");
  }

  const readable = slugifyKeySource(name);
  const base = readable || `${fallbackPrefix || "item"}_${randomSuffix(6)}`;

  if (!(await exists(base))) return base;

  for (let index = 2; index <= 9; index += 1) {
    const candidate = `${base}_${index}`;
    if (!(await exists(candidate))) return candidate;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}_${randomSuffix(4)}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${base}_${randomSuffix(8)}`;
}

module.exports = {
  CARD_VARIANTS,
  DEFAULT_CARD_VARIANT,
  DEFAULT_GROUP_DISPLAY_STYLE,
  GROUP_DISPLAY_STYLES,
  SNAKE_CASE_PATTERN,
  generateUniqueKey,
  inferCardVariantFromKey,
  isAllowedCardVariant,
  isAllowedGroupDisplayStyle,
  normalizeGroupUiMetadata,
  normalizeProductUiMetadata,
  normalizeUiMetadata,
  sanitizeCardVariant,
  sanitizeGroupDisplayStyle,
  slugifyKeySource,
};
