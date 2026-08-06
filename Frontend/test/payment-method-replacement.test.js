import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("authenticated replacement uses the old payment from the 409 response exactly once", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const replacementStart = page.indexOf("const replacePaymentNow");
  const replacementEnd = page.indexOf("const copyText", replacementStart);
  const replacement = page.slice(replacementStart, replacementEnd);

  assert.match(page, /activePayment,\s*requestedMethod/);
  assert.match(page, /onClick=\{replacePaymentNow\}/);
  assert.match(page, /<button type="button" onClick=\{replacePaymentNow\}/);
  assert.match(replacement, /await replacePayment\(oldPaymentId, \{ method, idempotencyKey: replacementKey \}\)/);
  assert.doesNotMatch(replacement, /createPayment\(/);
  assert.match(replacement, /preventDefault\(\)/);
  assert.match(replacement, /stopPropagation\(\)/);
  assert.match(replacement, /replacementSubmitRef\.current = true/);
});

test("guest replacement uses the shared explicit endpoint and does not retry normal creation", () => {
  const page = read("../src/pages/customer/RentalOrderSuccessPage.jsx");
  const replacementStart = page.indexOf("const replaceGuestPayment");
  const replacementEnd = page.indexOf("const saveGuestRefundDestination", replacementStart);
  const replacement = page.slice(replacementStart, replacementEnd);
  const client = read("../src/services/paymentService.js");

  assert.match(page, /onClick=\{replaceGuestPayment\}/);
  assert.match(page, /activePayment,\s*requestedMethod/);
  assert.match(replacement, /await replacePayment\(oldPaymentId, \{ method, idempotencyKey: replacementKey \}, guestConfig\(token\)\)/);
  assert.doesNotMatch(replacement, /createPayment\(/);
  assert.match(replacement, /submittingRef\.current = true/);
  assert.match(client, /post\(`\/payments\/\$\{id\}\/replace`/);
});

test("the initial 409 response is projected into the confirmation state", () => {
  const customer = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const guest = read("../src/pages/customer/RentalOrderSuccessPage.jsx");
  assert.match(customer, /PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED/);
  assert.match(customer, /activePayment/);
  assert.match(customer, /requestedMethod/);
  assert.match(guest, /PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED/);
  assert.match(guest, /activePayment/);
  assert.match(guest, /requestedMethod/);
});

test("keeping the old payment reloads it without creating another payment", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const panel = page.slice(page.indexOf("paymentDraft.methodChangeConfirmation"), page.indexOf("!created ?", page.indexOf("paymentDraft.methodChangeConfirmation")));
  const keepStart = page.indexOf("const keepPaymentNow");
  const keep = page.slice(keepStart, page.indexOf("const replacePaymentNow", keepStart));
  assert.match(panel, /onClick=\{keepPaymentNow\}/);
  assert.match(keep, /preventDefault\(\)/);
  assert.match(keep, /stopPropagation\(\)/);
  assert.match(keep, /await getPaymentStatus\(activePaymentId\)/);
  assert.match(keep, /methodChangeConfirmation: null/);
  assert.match(keep, /createdPayment: keptPayment/);
  assert.doesNotMatch(keep, /replacePayment\(|createPayment\(/);
  assert.doesNotMatch(panel, /replacePayment\(|createPayment\(/);
});

test("the replacement handler passes the payment id returned by the conflict", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const start = page.indexOf("const replacePaymentNow");
  const replacement = page.slice(start, page.indexOf("const copyText", start));
  assert.match(replacement, /oldPaymentId = confirmation\?\.activePayment\?\.id/);
  assert.match(replacement, /replacePayment\(oldPaymentId/);
});

test("the requested method is carried from the conflict instead of reconstructed from status", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  assert.match(page, /requestedMethod: err\.data\?\.requestedMethod \|\| current\.selectedMethod\?\.method/);
  assert.match(page, /const method = confirmation\?\.requestedMethod \|\| paymentDraft\?\.selectedMethod\?\.method/);
});

test("both confirmation actions are non-submit buttons", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const start = page.indexOf("ara-payment-method-change-confirmation");
  const panel = page.slice(start, page.indexOf("ara-payment-flow-progress", start));
  assert.equal((panel.match(/type\s*=\s*"button"/g) || []).length, 2);
});

test("the synchronous lock blocks a second replacement click", () => {
  const customer = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const guest = read("../src/pages/customer/RentalOrderSuccessPage.jsx");
  assert.match(customer, /replacementSubmitRef\.current \|\| paymentSubmitRef\.current \|\| submittingPayment/);
  assert.match(customer, /replacementSubmitRef\.current = true/);
  assert.match(guest, /submittingRef\.current \|\| submitting/);
  assert.match(guest, /submittingRef\.current = true/);
});

test("missing conflict payment id does not call the replacement API", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const start = page.indexOf("const replacePaymentNow");
  const replacement = page.slice(start, page.indexOf("const copyText", start));
  const guard = replacement.slice(0, replacement.indexOf("replacementSubmitRef.current = true"));
  assert.match(guard, /if \(!oldPaymentId \|\| !method\)/);
  assert.doesNotMatch(guard, /replacePayment\(/);
  assert.match(guard, /await load\(undefined, \{ silent: true \}\)/);
});

test("business and provider errors refresh state without retrying normal creation", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const start = page.indexOf("const replacePaymentNow");
  const replacement = page.slice(start, page.indexOf("const copyText", start));
  assert.match(replacement, /await load\(undefined, \{ silent: true \}\)/);
  assert.match(replacement, /notify\?\.\(err\.message/);
  assert.doesNotMatch(replacement, /await createPayment\(/);
  assert.doesNotMatch(replacement, /submitPayment\(/);
});

test("successful replacement closes the conflict and installs the new payment", () => {
  const page = read("../src/pages/customer/MyOrderDetailPage.jsx");
  const start = page.indexOf("const replacePaymentNow");
  const replacement = page.slice(start, page.indexOf("const copyText", start));
  assert.match(replacement, /createdPayment: payment/);
  assert.match(replacement, /methodChangeConfirmation: null/);
  assert.match(replacement, /await load\(\)/);
});
