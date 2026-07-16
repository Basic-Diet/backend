const { isPhase1NonCheckoutPaidIdempotencyEnabled } = require("../../utils/featureFlags");
const { getPaymentMetadata } = require("./subscriptionCheckoutHelpers");

function buildErrorResult(status, code, message, details) {
  return {
    ok: false,
    status,
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  };
}

function buildSuccessResult(status, data) {
  return {
    ok: true,
    status,
    data,
  };
}

function isReusableInitiatedPayment(payment) {
  const metadata = getPaymentMetadata(payment);
  return Boolean(
    payment
    && payment.status === "initiated"
    && payment.applied !== true
    && payment.providerInvoiceId
    && typeof metadata.paymentUrl === "string"
    && metadata.paymentUrl.trim()
  );
}

function buildNonCheckoutInitiationPayload(payment, fallbackResponseShape) {
  const metadata = getPaymentMetadata(payment);
  const responseShape = String(metadata.initiationResponseShape || fallbackResponseShape || "").trim();
  const redirectContext = metadata.redirectContext && typeof metadata.redirectContext === "object"
    ? metadata.redirectContext
    : null;
  const payload = {
    payment_url: metadata.paymentUrl || "",
    invoice_id: payment && payment.providerInvoiceId ? payment.providerInvoiceId : null,
    payment_id: payment && payment.id ? payment.id : (payment && payment._id ? String(payment._id) : null),
  };

  if (redirectContext && redirectContext.token && redirectContext.paymentType) {
    const verifyParams = new URLSearchParams({
      payment_type: String(redirectContext.paymentType || ""),
      token: String(redirectContext.token || ""),
    });
    if (redirectContext.draftId) verifyParams.set("draft_id", String(redirectContext.draftId));
    if (redirectContext.subscriptionId) verifyParams.set("subscription_id", String(redirectContext.subscriptionId));
    if (redirectContext.dayId) verifyParams.set("day_id", String(redirectContext.dayId));
    if (redirectContext.date) verifyParams.set("date", String(redirectContext.date));
    payload.verify_url = `/api/payments/verify?${verifyParams.toString()}`;
  }

  if (
    responseShape === "premium_overage_day"
    || responseShape === "premium_extra_day"
    || responseShape === "one_time_addon_day_planning"
    || responseShape === "day_planning_payment"
  ) {
    payload.totalHalala = Number(
      metadata.totalHalala !== undefined && metadata.totalHalala !== null
        ? metadata.totalHalala
        : payment && payment.amount !== undefined
          ? payment.amount
          : 0
    );
  }

  return payload;
}

function buildFinalizedPaymentPayload(payment, fallbackResponseShape) {
  const base = buildNonCheckoutInitiationPayload(payment, fallbackResponseShape);
  const status = String(payment && payment.status || "").trim().toLowerCase();
  return {
    ...base,
    payment_url: "",
    paymentStatus: status || null,
    status: status || null,
    applied: Boolean(payment && payment.applied),
    isFinal: true,
    alreadyFinalized: true,
    requiresNewIdempotencyKey: status !== "paid",
    messageAr: status === "paid"
      ? "تم إتمام الدفع بالفعل"
      : "انتهت محاولة الدفع السابقة، ابدأ محاولة دفع جديدة",
    messageEn: status === "paid"
      ? "Payment has already been completed"
      : "The previous payment attempt is finalized. Start a new payment attempt.",
  };
}

async function resolveNonCheckoutIdempotency({
  headers = {},
  body = {},
  userId,
  operationScope,
  effectivePayload,
  fallbackResponseShape,
  runtime,
}) {
  let operationIdempotencyKey = "";
  try {
    operationIdempotencyKey = runtime.parseOperationIdempotencyKey({ headers, body });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return buildErrorResult(400, "VALIDATION_ERROR", err.message);
    }
    throw err;
  }

  if (!operationIdempotencyKey) {
    return { ok: true, status: 200, shouldContinue: true, idempotencyKey: "", operationRequestHash: "" };
  }

  const operationRequestHash = runtime.buildOperationRequestHash({
    scope: operationScope,
    userId,
    effectivePayload,
  });

  if (!isPhase1NonCheckoutPaidIdempotencyEnabled()) {
    return {
      ok: true,
      status: 200,
      shouldContinue: true,
      idempotencyKey: operationIdempotencyKey,
      operationRequestHash,
    };
  }

  const existingByKey = await runtime.findPaymentByOperationKey({
    userId,
    operationScope,
    operationIdempotencyKey,
  });

  if (existingByKey) {
    if (!existingByKey.operationRequestHash) {
      return buildErrorResult(409, "IDEMPOTENCY_CONFLICT", "This payment key was used by an incompatible payment attempt", {
        messageAr: "مفتاح محاولة الدفع مستخدم في عملية أخرى",
        messageEn: "This payment key was used by an incompatible payment attempt",
        requiresNewIdempotencyKey: true,
      });
    }

    const decision = runtime.compareIdempotentRequest({
      existingRequestHash: existingByKey.operationRequestHash,
      incomingRequestHash: operationRequestHash,
    });

    if (decision === "conflict") {
      return buildErrorResult(409, "IDEMPOTENCY_CONFLICT", "This payment key was used with different payment details", {
        messageAr: "مفتاح محاولة الدفع مستخدم مع تفاصيل دفع مختلفة",
        messageEn: "This payment key was used with different payment details",
        requiresNewIdempotencyKey: true,
      });
    }

    if (decision === "reuse" && isReusableInitiatedPayment(existingByKey)) {
      return buildSuccessResult(200, buildNonCheckoutInitiationPayload(existingByKey, fallbackResponseShape));
    }

    if (decision === "reuse") {
      const finalizedPayload = buildFinalizedPaymentPayload(existingByKey, fallbackResponseShape);
      if (String(existingByKey.status || "").toLowerCase() === "paid") {
        return buildSuccessResult(200, finalizedPayload);
      }
      return buildErrorResult(409, "PAYMENT_ATTEMPT_FINALIZED", finalizedPayload.messageEn, finalizedPayload);
    }

    return buildErrorResult(409, "IDEMPOTENCY_CONFLICT", "Payment key conflict", {
      messageAr: "تعارض في مفتاح محاولة الدفع",
      messageEn: "Payment key conflict",
      requiresNewIdempotencyKey: true,
    });
  }

  const existingByHash = await runtime.findReusableInitiatedPaymentByHash({
    userId,
    operationScope,
    operationRequestHash,
  });

  if (existingByHash && isReusableInitiatedPayment(existingByHash)) {
    return buildSuccessResult(200, buildNonCheckoutInitiationPayload(existingByHash, fallbackResponseShape));
  }

  return {
    ok: true,
    status: 200,
    shouldContinue: true,
    idempotencyKey: operationIdempotencyKey,
    operationRequestHash,
  };
}

module.exports = {
  buildErrorResult,
  buildSuccessResult,
  isReusableInitiatedPayment,
  buildNonCheckoutInitiationPayload,
  buildFinalizedPaymentPayload,
  resolveNonCheckoutIdempotency,
};
