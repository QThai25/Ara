import assert from "node:assert/strict";
import test from "node:test";
import { DepositRefund } from "../src/models/DepositRefund.js";
import { Payment } from "../src/models/Payment.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import * as refundService from "../src/services/refund.service.js";
import { ADMIN_PERMISSIONS as P } from "../src/utils/adminPermissions.js";
import { resolveAdminRoutePermission } from "../src/policies/adminRoute.policy.js";
import { cloudinary } from "../src/config/cloudinary.js";

const staff = { _id: "staff-1", role: "staff" };
const owner = { _id: "owner-1", role: "owner" };

const refundFixture = {
  _id: "refund-1",
  refundCode: "ARARF-SECURITY",
  source: "settlement",
  status: "processing",
  amount: 250000,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  updatedAt: new Date("2026-08-01T11:00:00Z"),
  orderId: { _id: "order-1", orderCode: "ARA-001", depositDeduction: 250000, refundAmount: 250000 },
  customerId: { _id: "customer-1", name: "Nguyễn Văn A", phone: "0900000000", email: "customer@example.com" },
  paymentId: { providerTransactionId: "provider-secret", status: "success" },
  refundDestinationSnapshot: { bankName: "Test Bank", accountNumber: "123456789", accountName: "NGUYEN VAN A" },
  transferProofAssets: [{ publicId: "private-proof", mimeType: "image/jpeg", uploadedAt: new Date("2026-08-01T11:00:00Z") }],
  transactionReference: "bank-transfer-secret",
  auditTrail: [{ action: "refund.started", actorId: "owner-1" }]
};

function query(value) {
  const result = {
    populate() { return result; },
    select() { return result; },
    sort() { return result; },
    skip() { return result; },
    limit() { return result; },
    lean() { return result; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
  return result;
}

test("Staff refund list/detail are backend-safe while Owner retains sensitive detail", async () => {
  const originals = {
    find: DepositRefund.find,
    findOne: DepositRefund.findOne,
    countDocuments: DepositRefund.countDocuments,
    aggregate: DepositRefund.aggregate
  };
  const originalCloudinaryConfig = cloudinary.config();
  cloudinary.config({ ...originalCloudinaryConfig, cloud_name: "test", api_key: "test", api_secret: "test" });
  DepositRefund.find = () => query([refundFixture]);
  DepositRefund.findOne = () => query(refundFixture);
  DepositRefund.countDocuments = async () => 1;
  DepositRefund.aggregate = () => query([{ _id: "processing", count: 1, amount: 250000 }]);

  try {
    const staffList = await refundService.list({ source: "settlement" }, staff);
    const staffDetail = await refundService.detail("refund-1", { source: "settlement", actor: staff });
    const ownerDetail = await refundService.detail("refund-1", { source: "settlement", actor: owner });
    const staffJson = JSON.stringify({ staffList, staffDetail });

    assert.equal(staffList.items.length, 1);
    assert.equal(staffList.items[0].amount, 250000);
    assert.equal(staffList.items[0].customerId.name, "Nguyễn Văn A");
    assert.equal(staffList.summary.processing.amount, undefined);
    assert.equal(staffDetail.orderId.orderCode, "ARA-001");
    assert.equal(staffDetail.allowedActions.viewDetails, true);
    assert.equal(staffDetail.allowedActions.completeTransfer, undefined);
    assert.equal(staffDetail.allowedActions.reportFailure, undefined);
    assert.doesNotMatch(staffJson, /customer@example\.com|0900000000|123456789|provider-secret|bank-transfer-secret|private-proof|accessUrl|auditTrail/);

    assert.equal(ownerDetail.customerId.email, "customer@example.com");
    assert.equal(ownerDetail.refundDestinationSnapshot.accountNumber, "123456789");
    assert.equal(ownerDetail.transferProofAssets[0].accessUrl.includes("private-proof"), true);
    assert.equal(ownerDetail.allowedActions.completeTransfer, true);
    assert.equal(ownerDetail.allowedActions.reportFailure, true);
  } finally {
    Object.assign(DepositRefund, originals);
    cloudinary.config(originalCloudinaryConfig);
  }
});

test("Refund route and service guards enforce status/process/complete permissions", async () => {
  const request = (method, path) => ({ method, path });
  assert.equal(resolveAdminRoutePermission("/admin/refunds", request("GET", "/refund-1")), P.REFUNDS_VIEW_STATUS);
  assert.equal(resolveAdminRoutePermission("/admin/refunds", request("PATCH", "/refund-1/complete")), P.REFUNDS_COMPLETE);
  await assert.rejects(() => refundService.start("refund-1", staff), (error) => error.statusCode === 403);
  await assert.rejects(() => refundService.complete("refund-1", { transactionReference: "x" }, staff), (error) => error.statusCode === 403);
});

test("Staff search/context projections omit provider, contact and destination data", async () => {
  const originals = {
    paymentFind: Payment.find,
    orderFind: RentalOrder.find,
    orderFindById: RentalOrder.findById,
    refundFind: DepositRefund.find,
    userFind: (await import("../src/models/User.js")).User.find
  };
  const payment = { _id: "payment-1", orderId: "order-1", customerId: "customer-1", paymentReference: "payment-secret", providerTransactionId: "provider-secret", status: "success", method: "bank_transfer", provider: "provider", amount: 500000 };
  const order = { _id: "order-1", orderCode: "ARA-001", customerId: { _id: "customer-1", name: "Nguyễn Văn A", phone: "0900000000", email: "customer@example.com" }, status: "completed", paymentStatus: "paid", refundDestinationSnapshot: { bankBin: "970415", bankName: "Test Bank", accountName: "NGUYEN VAN A", accountNumber: "123456789" } };
  const customer = { _id: "customer-1", name: "Nguyễn Văn A", phone: "0900000000", email: "customer@example.com" };
  Payment.find = () => query([payment]);
  RentalOrder.find = () => query([order]);
  RentalOrder.findById = () => query(order);
  DepositRefund.find = () => query([]);
  const { User } = await import("../src/models/User.js");
  User.find = () => query([customer]);

  try {
    const search = await refundService.searchManualRefundContexts("secret", 20, staff);
    const context = await refundService.getManualRefundContext({ orderId: "order-1" }, staff);
    const response = JSON.stringify({ search, context });
    assert.equal(search.items[0].customer.name, "Nguyễn Văn A");
    assert.equal(search.items[0].paymentCode, undefined);
    assert.equal(context.customer.phone, undefined);
    assert.equal(context.destination, undefined);
    assert.equal(context.refundLedger, undefined);
    assert.doesNotMatch(response, /customer@example\.com|0900000000|payment-secret|provider-secret|123456789|destination|refundLedger/);
  } finally {
    Payment.find = originals.paymentFind;
    RentalOrder.find = originals.orderFind;
    RentalOrder.findById = originals.orderFindById;
    DepositRefund.find = originals.refundFind;
    User.find = originals.userFind;
  }
});
