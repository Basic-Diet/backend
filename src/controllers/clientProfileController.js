const AppUser = require("../models/AppUser");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Order = require("../models/Order");
const { resolveReadLabel } = require("../utils/subscription/subscriptionReadLocalization");
const errorResponse = require("../utils/errorResponse");

function serializeProfileUser(coreUser, appUser = null) {
  return {
    id: String(coreUser._id),
    displayName: appUser?.fullName || coreUser.name || "عميل",
    fullName: coreUser.name || appUser?.fullName || null,
    email: coreUser.email || appUser?.email || null,
    phone: coreUser.phone || coreUser.phoneE164 || null,
    phoneE164: coreUser.phoneE164 || coreUser.phone || null,
    avatarUrl: coreUser.avatarUrl || null,
  };
}

function normalizeOptionalFullName(fullName) {
  if (fullName === undefined) return undefined;
  if (fullName === null) return null;
  const normalized = String(fullName).trim();
  if (!normalized) return null;
  if (normalized.length > 120) {
    const err = new Error("fullName must be at most 120 characters");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return normalized;
}

function normalizeOptionalEmail(email) {
  if (email === undefined) return undefined;
  if (email === null) return null;
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    const err = new Error("email must be a valid email address");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return normalized;
}

async function ensureEmailAvailable(email, coreUser) {
  if (!email) return;
  const [existingUser, existingAppUser] = await Promise.all([
    User.findOne({ email }).lean(),
    AppUser.findOne({ email }).lean(),
  ]);
  const userId = String(coreUser._id);
  const phone = String(coreUser.phoneE164 || coreUser.phone || "");

  if (existingUser && String(existingUser._id) !== userId) {
    const err = new Error("email is already in use");
    err.status = 409;
    err.code = "EMAIL_IN_USE";
    throw err;
  }
  if (
    existingAppUser
    && String(existingAppUser.coreUserId || "") !== userId
    && String(existingAppUser.phone || "") !== phone
  ) {
    const err = new Error("email is already in use");
    err.status = 409;
    err.code = "EMAIL_IN_USE";
    throw err;
  }
}

async function syncAppUser(coreUser) {
  const phone = coreUser.phoneE164 || coreUser.phone;
  if (!phone) return null;
  let appUser = await AppUser.findOne({ coreUserId: coreUser._id });
  if (!appUser) {
    appUser = await AppUser.findOne({ phone });
  }
  if (!appUser) {
    appUser = new AppUser({ phone, coreUserId: coreUser._id });
  }
  appUser.phone = phone;
  appUser.coreUserId = coreUser._id;
  appUser.fullName = coreUser.name || undefined;
  appUser.email = coreUser.email || undefined;
  await appUser.save();
  return appUser;
}

async function getClientProfile(req, res) {
  try {
    const userId = req.userId;

    // 1. Basic User Data
    const [appUser, coreUser] = await Promise.all([
      AppUser.findOne({ coreUserId: userId }).lean(),
      User.findById(userId).lean(),
    ]);

    if (!coreUser) {
      return res.status(401).json({ status: false, message: "User not found" });
    }

    const userData = serializeProfileUser(coreUser, appUser);

    // 2. Subscription Summary
    const activeSub = await Subscription.findOne({
      userId: userId,
      status: { $in: ["active", "frozen"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    let subscriptionSummary = {
      hasActiveSubscription: false,
      planName: null,
      status: "none",
      statusLabelAr: null,
      remainingMeals: 0,
      totalMeals: 0,
    };

    if (activeSub) {
      // Get plan name from contract snapshot or plan ID
      let planNameAr = null;
      if (activeSub.contractSnapshot?.plan?.planName) {
        planNameAr = activeSub.contractSnapshot.plan.planName.ar || activeSub.contractSnapshot.plan.planName;
      }

      subscriptionSummary = {
        hasActiveSubscription: true,
        planName: planNameAr,
        status: activeSub.status,
        statusLabelAr: resolveReadLabel("subscriptionStatuses", activeSub.status, "ar"),
        remainingMeals: activeSub.remainingMeals || 0,
        totalMeals: activeSub.totalMeals || 0,
      };
    }

    // 3. Profile Menu Items
    const [ordersCount, subscriptionAddresses, orderAddresses] = await Promise.all([
      Order.countDocuments({ userId: userId, status: { $ne: "cancelled" } }),
      Subscription.find({ userId: userId }).select("deliveryAddress").lean(),
      Order.find({ userId: userId }).select("deliveryAddress").lean(),
    ]);

    // Unique addresses logic
    const uniqueAddresses = new Set();
    
    subscriptionAddresses.forEach(sub => {
      if (sub.deliveryAddress && sub.deliveryAddress.line1) {
        uniqueAddresses.add(`${sub.deliveryAddress.line1}-${sub.deliveryAddress.city}`);
      }
    });
    
    orderAddresses.forEach(order => {
      if (order.deliveryAddress && order.deliveryAddress.line1) {
        uniqueAddresses.add(`${order.deliveryAddress.line1}-${order.deliveryAddress.city}`);
      }
    });

    const addressesCount = uniqueAddresses.size;

    const profileMenu = {
      orders: {
        labelAr: "طلباتي",
        count: ordersCount,
      },
      addresses: {
        labelAr: "عناويني",
        count: addressesCount,
      },
      language: {
        labelAr: "اللغة",
        current: "العربية",
        code: "ar",
      },
      support: {
        labelAr: "الدعم",
        phone: null, // Placeholder
        whatsapp: null, // Placeholder
        email: null, // Placeholder
      },
      legal: {
        labelAr: "الشروط والخصوصية",
        termsUrl: `${process.env.BASE_URL || ""}/terms`,
        privacyUrl: `${process.env.BASE_URL || ""}/privacy`,
      },
    };

    return res.status(200).json({
      status: true,
      data: {
        user: userData,
        subscriptionSummary,
        profileMenu,
      },
    });
  } catch (error) {
    console.error("getClientProfile error:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
}

async function updateClientProfile(req, res) {
  try {
    const body = req.body || {};
    const hasFullName = Object.prototype.hasOwnProperty.call(body, "fullName");
    const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
    if (!hasFullName && !hasEmail) {
      return errorResponse(res, 422, "VALIDATION_ERROR", "At least one of fullName or email is required");
    }

    const coreUser = await User.findOne({ _id: req.userId, role: "client" });
    if (!coreUser) {
      return errorResponse(res, 401, "AUTH_REQUIRED", "Authentication required");
    }

    if (hasFullName) {
      const normalizedFullName = normalizeOptionalFullName(body.fullName);
      coreUser.name = normalizedFullName || undefined;
    }

    if (hasEmail) {
      const normalizedEmail = normalizeOptionalEmail(body.email);
      await ensureEmailAvailable(normalizedEmail, coreUser);
      coreUser.email = normalizedEmail || undefined;
    }

    await coreUser.save();
    const appUser = await syncAppUser(coreUser);

    return res.status(200).json({
      status: true,
      data: {
        user: serializeProfileUser(coreUser, appUser),
      },
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return errorResponse(res, 409, "EMAIL_IN_USE", "email is already in use");
    }
    if (error && error.status && error.code) {
      return errorResponse(res, error.status, error.code, error.message, error.details);
    }
    console.error("updateClientProfile error:", error);
    return errorResponse(res, 500, "INTERNAL", "Internal server error");
  }
}

module.exports = {
  getClientProfile,
  updateClientProfile,
};
