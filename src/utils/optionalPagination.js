"use strict";

/**
 * Resolves optional pagination parameters from query string.
 * 
 * If neither page nor limit is provided, returns null (no pagination).
 * If page or limit is provided, validates strictly and returns pagination config.
 * 
 * @param {Object} query - Query parameters object
 * @param {number} maxLimit - Maximum allowed limit
 * @param {number} defaultLimit - Default limit when only page is provided
 * @returns {Object|null} - { page, limit } or null if no pagination requested
 * @throws {Error} - If page or limit is invalid
 */
function resolveOptionalPagination(query = {}, maxLimit, defaultLimit = 50) {
  const pageRaw = query.page;
  const limitRaw = query.limit;

  // If neither provided, return null (no pagination)
  if (pageRaw === undefined && limitRaw === undefined) {
    return null;
  }

  // Validate page if provided
  let page = 1;
  if (pageRaw !== undefined && pageRaw !== null && pageRaw !== "") {
    const parsed = parseInt(String(pageRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      const err = new Error("page must be a positive integer");
      err.status = 400;
      err.code = "INVALID_PAGINATION";
      throw err;
    }
    page = parsed;
  }

  // Validate limit if provided
  let limit = defaultLimit;
  if (limitRaw !== undefined && limitRaw !== null && limitRaw !== "") {
    const parsed = parseInt(String(limitRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      const err = new Error("limit must be a positive integer");
      err.status = 400;
      err.code = "INVALID_PAGINATION";
      throw err;
    }
    // Clamp to max limit
    limit = Math.min(parsed, maxLimit);
  }

  return { page, limit };
}

/**
 * Builds pagination meta object for response.
 * 
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} - { page, limit, total, totalPages }
 */
function buildPaginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

module.exports = {
  resolveOptionalPagination,
  buildPaginationMeta,
};
