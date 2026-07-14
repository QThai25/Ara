import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import mongoose from "mongoose";
import { Notification, NOTIFICATION_TYPES } from "../src/models/Notification.js";
import { orderNotification, paymentNotification } from "../src/services/notification-template.js";
import { notificationTaxonomy, typesForTaxonomy } from "../src/utils/notificationTaxonomy.js";

const objectId = () => new mongoose.Types.ObjectId();

test("notification model keeps recipient, read state, deep link and dedupe fields", async () => {
  const recipientId = objectId();
  const notification = new Notification({
    recipientId, recipientRole: "customer", type: "order_created", title: "Có đơn mới",
    message: "Nội dung", entityType: "rental_order", entityId: objectId(), actionUrl: "/my-rentals/1",
    eventKey: "order:1:created", priority: "high"
  });
  await notification.validate();
  assert.equal(String(notification.userId), String(recipientId));
  assert.equal(notification.content, "Nội dung");
  assert.equal(notification.isRead, false);
});

test("notification model has recipient timeline, unread and unique event indexes", () => {
  const indexes = Notification.schema.indexes();
  assert(indexes.some(([fields]) => fields.recipientId === 1 && fields.createdAt === -1));
  assert(indexes.some(([fields]) => fields.recipientId === 1 && fields.isRead === 1));
  assert(indexes.some(([fields, options]) => fields.recipientId === 1 && fields.eventKey === 1 && options.unique));
});

test("notification API never accepts recipientId and scopes operations to req.user", () => {
  const controller = fs.readFileSync(new URL("../src/controllers/notification.controller.js", import.meta.url), "utf8");
  const routes = fs.readFileSync(new URL("../src/routes/notification.routes.js", import.meta.url), "utf8");
  assert.match(controller, /req\.user\._id/);
  assert.doesNotMatch(routes, /post\s*\(/i);
  assert.match(routes, /unread-count/);
  assert.match(routes, /read-all/);
});

test("notification listing implements pagination and supported filters", () => {
  const source = fs.readFileSync(new URL("../src/services/notification.service.js", import.meta.url), "utf8");
  for (const field of ["isRead", "type", "priority"]) assert.match(source, new RegExp(`params\\.${field}`));
  assert.match(source, /Math\.min\(50/);
  assert.match(source, /createdAt:\s*-1/);
});

test("order templates distinguish customer and admin creation messages", () => {
  const order = { _id: objectId(), rentalDate: new Date(), returnDate: new Date(Date.now() + 86400000), totalRentalPrice: 500000 };
  const customer = orderNotification("created_customer", order);
  const admin = orderNotification("created_admin", order, { customerName: "An" });
  assert.equal(customer.type, "order_created");
  assert.match(customer.actionUrl, /^\/my-rentals\//);
  assert.equal(admin.priority, "high");
  assert.match(admin.actionUrl, /^\/orders\//);
  assert.match(admin.message, /An/);
});

test("direct payment request says awaiting confirmation, never success", () => {
  const payment = { _id: objectId(), orderId: objectId(), paymentType: "deposit", method: "cash", amount: 250000, paymentReference: "ARA-DEP-1" };
  const notice = paymentNotification("requested_customer", payment, { _id: payment.orderId });
  assert.equal(notice.type, "payment_awaiting_confirmation");
  assert.match(notice.title, /chờ xác nhận/i);
  assert.doesNotMatch(notice.message, /thành công/i);
});

test("payment templates provide specific success and rejection events", () => {
  const order = { _id: objectId() };
  const payment = { _id: objectId(), orderId: order._id, paymentType: "penalty", amount: 30000, paidAt: new Date() };
  assert.equal(paymentNotification("success", payment, order).type, "penalty_payment_confirmed");
  const rejected = paymentNotification("rejected", payment, order, { reason: "Chưa nhận được tiền" });
  assert.equal(rejected.type, "payment_rejected");
  assert.match(rejected.message, /Chưa nhận được tiền/);
});

test("scheduler uses stable event keys for due and overdue notifications", () => {
  const source = fs.readFileSync(new URL("../src/services/notification-scheduler.service.js", import.meta.url), "utf8");
  assert.match(source, /due_24h/);
  assert.match(source, /due_2h/);
  assert.match(source, /overdue:customer/);
  assert.match(source, /status:\s*\{\s*\$in:\s*RENTING_STATUSES/);
});

test("all business notification types emitted by templates are allowed by schema", () => {
  for (const type of ["order_created", "order_approved", "order_rejected", "order_ready_for_pickup", "order_returned", "order_completed", "payment_awaiting_confirmation", "payment_rejected", "penalty_payment_confirmed"]) {
    assert(NOTIFICATION_TYPES.includes(type), `${type} must be allowed`);
  }
});

test("legacy notification types normalize to category, subtype and admin action state", () => {
  assert.deepEqual(notificationTaxonomy("order_approved", "customer"), { category: "rental_order", subtype: "order_confirmed", requiresAction: false });
  assert.deepEqual(notificationTaxonomy("deposit_payment_requested", "admin"), { category: "payment", subtype: "deposit_pending", requiresAction: true });
  assert.equal(notificationTaxonomy("order_overdue", "admin").category, "inventory");
  assert.equal(notificationTaxonomy("order_overdue", "customer").category, "rental_order");
});

test("semantic subtype filters expand to all matching legacy payment types", () => {
  const depositTypes = typesForTaxonomy("payment", "deposit");
  assert(depositTypes.includes("deposit_payment_requested"));
  assert(depositTypes.includes("deposit_payment_confirmed"));
  assert(!depositTypes.includes("full_payment_confirmed"));
});

test("notification API supports detailed filters, safe search, counts and admin endpoint", () => {
  const service = fs.readFileSync(new URL("../src/services/notification.service.js", import.meta.url), "utf8");
  const routes = fs.readFileSync(new URL("../src/routes/notification.routes.js", import.meta.url), "utf8");
  const routeIndex = fs.readFileSync(new URL("../src/routes/index.js", import.meta.url), "utf8");
  for (const field of ["category", "subtype", "requiresAction", "from", "to", "search", "sort"]) assert.match(service, new RegExp(`params\\.${field}`));
  assert.match(service, /escapeRegex/);
  assert.match(service, /counts:\s*\{ all, unread, read, requiresAction \}/);
  assert.match(routes, /adminNotificationRoutes/);
  assert.match(routeIndex, /\/admin\/notifications/);
});

test("notification model indexes category, subtype, priority and requiresAction per recipient", () => {
  const indexes = Notification.schema.indexes();
  assert(indexes.some(([fields]) => fields.recipientId === 1 && fields.category === 1 && fields.subtype === 1));
  assert(indexes.some(([fields]) => fields.recipientId === 1 && fields.requiresAction === 1 && fields.priority === 1));
});

test("customer notification filters persist in URL and reset subtype when category changes", () => {
  const page = fs.readFileSync(new URL("../../Frontend/src/pages/customer/NotificationsPage.jsx", import.meta.url), "utf8");
  assert.match(page, /useSearchParams/);
  assert.match(page, /category:\s*next, subtype:\s*""/);
  assert.match(page, /useDebouncedValue\(search, 400\)/);
  assert.match(page, /AbortController/);
  assert.doesNotMatch(page, /<select/i);
});

test("admin notification page uses detailed backend filters and custom controls", () => {
  const page = fs.readFileSync(new URL("../../AdminFrontend/src/pages/AdminNotificationPage.jsx", import.meta.url), "utf8");
  const service = fs.readFileSync(new URL("../../AdminFrontend/src/services/notificationService.js", import.meta.url), "utf8");
  for (const field of ["requiresAction", "category", "subtype", "priority", "sort"]) assert.match(page, new RegExp(field));
  assert.match(page, /ModalSelect/);
  assert.doesNotMatch(page, /<select/i);
  assert.match(service, /\/admin\/notifications/);
});

test("legacy notifications derive and migrate order deeplinks", () => {
  const service = fs.readFileSync(new URL("../src/services/notification.service.js", import.meta.url), "utf8");
  const migration = fs.readFileSync(new URL("../scripts/migrate-notification-deeplinks.js", import.meta.url), "utf8");
  const bell = fs.readFileSync(new URL("../../Frontend/src/components/customer/NotificationBell.jsx", import.meta.url), "utf8");
  assert.match(service, /fallbackDeeplink/);
  assert.match(service, /\/my-rentals\//);
  assert.match(migration, /rentalorders/);
  assert.match(migration, /actionUrl/);
  assert.match(bell, /notificationDeeplink/);
});
