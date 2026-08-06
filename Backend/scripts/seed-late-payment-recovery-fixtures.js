import "dotenv/config";
import crypto from "node:crypto";

const cleanup = process.argv.includes("--cleanup");
const fixtureGuard = String(process.env.ALLOW_TEST_FIXTURE_SEED || "").toLowerCase() === "true";
const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();

if (nodeEnv === "production") {
  throw new Error("Late-payment recovery fixtures are disabled in production.");
}
if (!fixtureGuard) {
  throw new Error("Set ALLOW_TEST_FIXTURE_SEED=true explicitly to create or clean QA fixtures.");
}

const configuredUri = String(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || "");
let configuredDatabaseName = "";
try {
  configuredDatabaseName = decodeURIComponent(new URL(configuredUri).pathname.replace(/^\//, ""));
} catch {
  throw new Error("Fixture seeding requires a valid MONGODB_URI/MONGO_URI/DATABASE_URL.");
}
console.log(`Fixture database (configured): ${configuredDatabaseName || "<default>"}`);
if (!/(test|dev|local|staging)/i.test(configuredDatabaseName)) {
  throw new Error(`Refusing fixture writes to configured database '${configuredDatabaseName || "<default>"}'. Use a test/dev/local/staging database.`);
}

const { connectMongo } = await import("../src/config/database.js");
const mongoose = (await import("mongoose")).default;
const { User } = await import("../src/models/User.js");
const { Category } = await import("../src/models/Category.js");
const { Costume } = await import("../src/models/Costume.js");
const { RentalOrder } = await import("../src/models/RentalOrder.js");
const { RentalOrderItem } = await import("../src/models/RentalOrderItem.js");
const { Payment } = await import("../src/models/Payment.js");
const { Reservation } = await import("../src/models/Reservation.js");
const { TransportReservation } = await import("../src/models/TransportReservation.js");
const { LatePaymentRecovery } = await import("../src/models/LatePaymentRecovery.js");
const { DepositRefund } = await import("../src/models/DepositRefund.js");
const { AuditLog } = await import("../src/models/AuditLog.js");

const CUSTOMER = {
  name: "QA Late Payment",
  email: "qa.latepayment@example.test",
  phone: "0900000099",
  phoneNormalized: "0900000099"
};
const CATEGORY = {
  name: "QA Late Payment Recovery Fixture",
  slug: "qa-late-payment-recovery-fixture"
};
const FIXTURES = [
  {
    key: "LATE_PAYMENT_REFUND_READY",
    orderCode: "QA-EXPIRED-TRANSFER-REFUND",
    costumeSku: "QA-LATE-RECOVERY-AVAILABLE",
    paymentReference: "QA-RECOVERY-AVAILABLE-TRANSFER",
    expectedOutcome: "refund_required"
  },
  {
    key: "LATE_PAYMENT_REFUND_SECOND_CASE",
    orderCode: "QA-EXPIRED-TRANSFER-REFUND-SECOND",
    costumeSku: "QA-LATE-RECOVERY-CONFLICT",
    paymentReference: "QA-RECOVERY-CONFLICT-TRANSFER",
    expectedOutcome: "refund_required"
  }
];

const options = (session) => session ? { session } : {};
const fixtureObjectId = (key) => new mongoose.Types.ObjectId(crypto.createHash("sha1").update(key).digest("hex").slice(0, 24));

async function withOptionalTransaction(work) {
  if (mongoose.connection.$araTransactionsSupported === false) return work(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function cleanupFixtures() {
  const orders = await RentalOrder.find({ orderCode: { $in: FIXTURES.map((fixture) => fixture.orderCode) } }).select("_id").lean();
  const orderIds = orders.map((order) => order._id);
  const costumes = await Costume.find({ skuCode: { $in: FIXTURES.map((fixture) => fixture.costumeSku) } }).select("_id").lean();
  const costumeIds = costumes.map((costume) => costume._id);
  if (orderIds.length) {
    await Promise.all([
      LatePaymentRecovery.deleteMany({ orderId: { $in: orderIds } }),
      DepositRefund.deleteMany({ orderId: { $in: orderIds } }),
      AuditLog.deleteMany({ resourceId: { $in: orderIds.map(String) } }),
      Payment.deleteMany({ orderId: { $in: orderIds } }),
      RentalOrderItem.deleteMany({ orderId: { $in: orderIds } }),
      Reservation.deleteMany({ orderId: { $in: orderIds } }),
      TransportReservation.deleteMany({ orderId: { $in: orderIds } }),
      RentalOrder.deleteMany({ _id: { $in: orderIds } })
    ]);
  }
  if (costumeIds.length) await Reservation.deleteMany({ costumeId: { $in: costumeIds } });
  await Costume.deleteMany({ skuCode: { $in: FIXTURES.map((fixture) => fixture.costumeSku) } });
  await Category.deleteOne({ slug: CATEGORY.slug });
  const customer = await User.findOne({ email: CUSTOMER.email }).select("_id").lean();
  if (customer && !(await RentalOrder.exists({ customerId: customer._id }))) {
    await User.deleteOne({ _id: customer._id, email: CUSTOMER.email });
  }
  console.log(`Cleaned fixture orders: ${FIXTURES.map((fixture) => fixture.orderCode).join(", ")}`);
}

async function seedFixtures(session) {
  const category = await Category.findOneAndUpdate(
    { slug: CATEGORY.slug },
    { $set: { name: CATEGORY.name, slug: CATEGORY.slug, status: "hidden", description: "QA fixture support record." } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, ...options(session) }
  );
  const existingCustomer = await User.findOne({ email: CUSTOMER.email });
  const customer = existingCustomer || await User.create([{
    ...CUSTOMER,
    role: "customer",
    status: "active",
    authMode: "phone_otp",
    isGuest: false,
    phoneVerified: true
  }], options(session)).then(([created]) => created);

  const baseDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const rentalDate = new Date(baseDate);
  rentalDate.setHours(10, 0, 0, 0);
  const returnDate = new Date(rentalDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  const expiredAt = new Date(Date.now() - 60 * 60 * 1000);
  const amount = 700000;
  const results = [];

  for (const fixture of FIXTURES) {
    const costume = await Costume.findOneAndUpdate(
      { skuCode: fixture.costumeSku },
      { $set: {
        name: fixture.key,
        description: "QA fixture costume for late-payment recovery; do not use for customer catalog testing.",
        categoryId: category._id,
        categoryName: category.name,
        categorySlug: category.slug,
        size: "M",
        color: "QA",
        material: "QA",
        rentalPricePerDay: 250000,
        standardRentalPrice: 250000,
        depositAmount: 200000,
        originalPrice: 2000000,
        status: "available",
        operationalStatus: "active",
        quantity: 1,
        image: "",
        images: [],
        skuCode: fixture.costumeSku
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, ...options(session) }
    );
    const order = await RentalOrder.findOneAndUpdate(
      { orderCode: fixture.orderCode },
      { $set: {
        paymentPreference: "bank_transfer",
        paymentMethod: "bank_transfer",
        approvalMode: "manual",
        customerId: customer._id,
        customerInfo: { fullName: CUSTOMER.name, phone: CUSTOMER.phone, phoneNormalized: CUSTOMER.phoneNormalized, email: CUSTOMER.email, isGuest: false, phoneVerified: true },
        policyAccepted: true,
        policyVersion: "QA_FIXTURE",
        policyAcceptedAt: expiredAt,
        schedule: { pickupAt: rentalDate, mainWearDate: rentalDate, dueReturnAt: returnDate },
        rentalDate,
        returnDate,
        rentalDays: 2,
        rentalDurationHours: 48,
        pickupMethod: "store_pickup",
        returnMethod: "store_return",
        source: "admin",
        idempotencyKey: `qa-late-payment-recovery-${fixture.key.toLowerCase()}`,
        plannedRentalStartAt: rentalDate,
        plannedRentalEndAt: returnDate,
        blockedStartAt: rentalDate,
        blockedEndAt: returnDate,
        totalRentalPrice: 500000,
        totalDepositAmount: 200000,
        grossRentalAmount: 500000,
        finalAmount: amount,
        deposit: { method: "full_rental", amount: 200000, status: "pending" },
        status: "expired",
        bookingStatus: "cancelled",
        paymentStatus: "expired",
        holdExpiresAt: expiredAt,
        paymentExpiresAt: expiredAt,
        expiredAt,
        note: `[QA_LATE_PAYMENT_RECOVERY_FIXTURE] ${fixture.key}`
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, ...options(session) }
    );
    const item = await RentalOrderItem.findOneAndUpdate(
      { orderId: order._id, costumeId: costume._id },
      { $set: { quantity: 1, rentalPricePerDay: 250000, depositAmount: 200000, subtotal: 500000 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, ...options(session) }
    );
    const payment = await Payment.findOneAndUpdate(
      { paymentReference: fixture.paymentReference },
      { $set: {
        orderId: order._id,
        customerId: customer._id,
        paymentType: "full",
        channel: "direct",
        method: "bank_transfer",
        amount,
        currency: "VND",
        status: "canceled",
        active: false,
        paymentGroup: "rental",
        provider: "manual",
        paymentReference: fixture.paymentReference,
        paymentExpiresAt: expiredAt,
        expiresAt: expiredAt,
        canceledAt: expiredAt,
        proofSubmittedAt: null,
        actualReceivedAmount: null,
        receivedAt: null,
        metadata: { fixtureKey: fixture.key, scenario: fixture.expectedOutcome }
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, ...options(session) }
    );
    await RentalOrder.updateOne({ _id: order._id }, { $set: { latestPaymentId: payment._id } }, options(session));
    await Reservation.findOneAndUpdate(
      { orderId: order._id, costumeId: costume._id },
      { $set: {
        orderItemId: item._id,
        quantity: 1,
        rentalDays: 2,
        pickupMethod: "store_pickup",
        returnMethod: "store_return",
        plannedRentalStartAt: rentalDate,
        plannedRentalEndAt: returnDate,
        blockedStartAt: rentalDate,
        blockedEndAt: returnDate,
        status: "expired",
        source: "admin",
        expiresAt: expiredAt
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, ...options(session) }
    );

    results.push({ fixture, order, payment });
  }
  return { customer, results };
}

await connectMongo();
const databaseName = mongoose.connection.db.databaseName;
console.log(`Fixture database: ${databaseName}`);
if (!/(test|dev|local|staging)/i.test(databaseName)) {
  await mongoose.disconnect();
  throw new Error(`Refusing fixture writes to database '${databaseName}'. Use a test/dev/local/staging database.`);
}

try {
  if (cleanup) {
    await cleanupFixtures();
  } else {
    await cleanupFixtures();
    const { customer, results } = await withOptionalTransaction(seedFixtures);
    console.log(`QA customer: ${customer._id}`);
    for (const { fixture, order, payment } of results) {
      console.log(`${fixture.key}: orderId=${order._id} paymentId=${payment._id} expected=${fixture.expectedOutcome}`);
      console.log(`Order URL: http://localhost:5174/orders/${order._id}`);
      console.log(`Payment URL: http://localhost:5174/payments/${payment._id}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
