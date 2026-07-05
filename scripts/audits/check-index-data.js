require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Payment = require("../src/models/Payment");

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const usersEmpty = await User.countDocuments({ email: "" });
  const usersNull = await User.countDocuments({ email: null });
  const usersMissing = await User.countDocuments({ email: { $exists: false } });

  const paymentsEmpty = await Payment.countDocuments({ operationIdempotencyKey: "" });
  const paymentsNull = await Payment.countDocuments({ operationIdempotencyKey: null });
  const paymentsMissing = await Payment.countDocuments({ operationIdempotencyKey: { $exists: false } });

  const duplicateEmails = await User.aggregate([
    { $match: { email: { $type: "string", $gt: "" } } },
    { $group: { _id: "$email", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  const duplicatePayments = await Payment.aggregate([
    { $match: { operationIdempotencyKey: { $type: "string", $gt: "" } } },
    { $group: { _id: "$operationIdempotencyKey", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log("=== DATA SAFETY CHECK ===");
  console.log("Users Email empty:", usersEmpty);
  console.log("Users Email null:", usersNull);
  console.log("Users Email missing:", usersMissing);
  console.log("Duplicate emails count:", duplicateEmails.length);

  console.log("Payments operationIdempotencyKey empty:", paymentsEmpty);
  console.log("Payments operationIdempotencyKey null:", paymentsNull);
  console.log("Payments operationIdempotencyKey missing:", paymentsMissing);
  console.log("Duplicate operationIdempotencyKeys count:", duplicatePayments.length);

  await mongoose.disconnect();
}

run().catch(console.error);
