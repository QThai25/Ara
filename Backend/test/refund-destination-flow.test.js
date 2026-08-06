import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildVietQrDataUrl, buildVietQrPayload, decodeVietQrImage, parseVietQr } from "../src/services/vietQr.service.js";

test("VietQR round trip validates CRC and ignores embedded amount as input", async () => {
  const input = { bankBin: "970422", accountNumber: "0123456789", amount: 123456, description: "ARARF-TEST" };
  const payload = buildVietQrPayload(input);
  const parsed = parseVietQr(payload);
  assert.equal(parsed.bankBin, input.bankBin);
  assert.equal(parsed.accountNumber, input.accountNumber);
  assert.equal(parsed.embeddedAmountIgnored, true);
  assert.equal(parsed.embeddedDescriptionIgnored, true);
  const dataUrl = await buildVietQrDataUrl(input);
  const decoded = await decodeVietQrImage(Buffer.from(dataUrl.split(",")[1], "base64"));
  assert.equal(decoded.accountNumber, input.accountNumber);
});

test("VietQR rejects a bad checksum and fake image", async () => {
  const payload = buildVietQrPayload({ bankBin: "970416", accountNumber: "25230017", amount: 1000, description: "ARARF-X" });
  assert.throws(() => parseVietQr(`${payload.slice(0, -1)}0`), /checksum/i);
  await assert.rejects(() => decodeVietQrImage(Buffer.from("not an image")), /không hợp lệ|không đọc/i);
});

test("checkout and settlement use an order refund snapshot as source of truth", () => {
  const payment = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  const refund = fs.readFileSync(new URL("../src/services/refund.service.js", import.meta.url), "utf8");
  const customerUi = fs.readFileSync(new URL("../../Frontend/src/pages/customer/MyOrderDetailPage.jsx", import.meta.url), "utf8");
  assert.match(payment, /refundDestinationSnapshot/);
  assert.match(payment, /xác nhận tài khoản nhận hoàn cọc/);
  assert.match(refund, /const storedSnapshot = order\.refundDestinationSnapshot/);
  assert.doesNotMatch(refund, /findOne\(\{ userId: order\.customerId, isDefault: true/);
  assert.match(customerUi, /step: 1/);
  assert.match(customerUi, /Tài khoản nhận hoàn cọc/);
  assert.match(customerUi, /Tạo mã QR thanh toán/);
});

test("customer checkout reuses a saved refund destination instead of forcing a new entry", () => {
  const customerUi = fs.readFileSync(new URL("../../Frontend/src/pages/customer/MyOrderDetailPage.jsx", import.meta.url), "utf8");
  assert.match(customerUi, /Array\.isArray\(refundDestinations\) \? refundDestinations : \[\]/);
  assert.match(customerUi, /selectedRefundDestination: defaultDestination/);
  assert.match(customerUi, /hasRefundDestinationSnapshot\(targetOrder\?\.refundDestinationSnapshot\)/);
  assert.match(customerUi, /hasRefundDestinationSnapshot\(paymentDraft\?\.order\?\.refundDestinationSnapshot\)/);
});

test("creating a new default refund destination avoids the partial unique index collision", () => {
  const accountService = fs.readFileSync(new URL("../src/services/accountAsset.service.js", import.meta.url), "utf8");
  assert.match(accountService, /const shouldBeDefault = body\.isDefault === true \|\| count === 0/);
  assert.match(accountService, /RefundDestination\.create\(\{ userId, \.\.\.await destinationInput\(body\), isDefault: false \}\)/);
  assert.match(accountService, /item\.isDefault = true;/);
});

test("PayOS webhook requires link id and never writes refund destination", () => {
  const payment = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  const webhook = payment.slice(payment.indexOf("export async function handlePayosWebhook"), payment.indexOf("export async function listAdminPayments"));
  assert.match(webhook, /!data\.paymentLinkId/);
  assert.match(webhook, /payerAccountMatchStatus/);
  assert.doesNotMatch(webhook, /refundDestinationSnapshot\s*=/);
  assert.doesNotMatch(webhook, /DepositRefund\.create/);
});

test("customer payment summary uses backend quotes and hides banking internals", () => {
  const detail = fs.readFileSync(new URL("../../Frontend/src/components/common/OrderDetail.jsx", import.meta.url), "utf8");
  assert.match(detail, /paymentQuotes\.deposit\.payableAmount/);
  assert.match(detail, /paymentQuotes\.full\.payableAmount/);
  assert.match(detail, /pricing\?\.remainingAmount/);
  assert.match(detail, /Chưa có tài khoản nhận hoàn cọc/);
  assert.match(detail, /Bổ sung tài khoản/);
  assert.doesNotMatch(detail, />BIN ngân hàng</);
  assert.doesNotMatch(detail, />Mã ngân hàng</);
  assert.doesNotMatch(detail, />verificationStatus</);
});

test("guest checkout must capture a destination scoped to its order before online deposit payment", () => {
  const payment = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  const uploadRoutes = fs.readFileSync(new URL("../src/routes/upload.routes.js", import.meta.url), "utf8");
  const guestUi = fs.readFileSync(new URL("../../Frontend/src/pages/customer/RentalOrderSuccessPage.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(payment, /user\?\.role !== "guest" && Number\(order\.totalDepositAmount/);
  assert.match(uploadRoutes, /refund-qr\/:orderId/);
  assert.match(uploadRoutes, /guestOrderId/);
  assert.match(guestUi, /captureOrderRefundDestination/);
  assert.match(guestUi, /Tài khoản nhận hoàn cọc/);
});

test("manual refund proof is private, order-scoped and never trusted from the complete payload", () => {
  const refund = fs.readFileSync(new URL("../src/services/refund.service.js", import.meta.url), "utf8");
  const routes = fs.readFileSync(new URL("../src/routes/refund.routes.js", import.meta.url), "utf8");
  const validation = fs.readFileSync(new URL("../src/validations/refund.validation.js", import.meta.url), "utf8");
  assert.match(routes, /\/:id\/proofs/);
  assert.match(refund, /type: "authenticated"/);
  assert.match(refund, /sharp\(file\.buffer\)\.metadata/);
  assert.match(refund, /status: "processing", "transferProofAssets\.4"/);
  assert.doesNotMatch(validation, /body\("transferProofAssets"\)/);
  assert.doesNotMatch(refund, /transferProofAssets: body\.transferProofAssets/);
});

test("refund completion rechecks the financial ledger and rejects replay", () => {
  const refund = fs.readFileSync(new URL("../src/services/refund.service.js", import.meta.url), "utf8");
  const complete = refund.slice(refund.indexOf("export async function complete"), refund.indexOf("export async function fail"));
  assert.match(complete, /getOrderFinancialSnapshot/);
  assert.match(complete, /refundableDepositAmount !== Number\(refund\.amount/);
  assert.match(complete, /đã hoàn tất và không thể xác nhận lại/);
  assert.match(complete, /transactionReference/);
  assert.match(complete, /error\?\.code === 11000/);
});
