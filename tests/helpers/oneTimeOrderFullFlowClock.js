"use strict";

// Keep the full-flow fixture deterministic. Its fulfillment date is 2026-05-10,
// so freeze the business-date helper to the preceding day instead of allowing
// the test to become historical as wall-clock time advances.
const dateUtils = require("../../src/utils/date");

dateUtils.getTodayKSADate = () => "2026-05-09";
