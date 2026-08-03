import mongoose from "mongoose";
import { emitOrderUpdated } from "../realtime/socket.js";
import { Costume } from "../models/Costume.js";
import { CostumeScheduleLock } from "../models/CostumeScheduleLock.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { ReturnInspection } from "../models/ReturnInspection.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { ADMIN_PERMISSIONS, hasAdminPermission, isAdminRole } from "../utils/adminPermissions.js";
import { calculateRentalReturnDate, isPastDate, parseLocalDateTime, rentalPriceBreakdown, RENTAL_TURNAROUND_MINUTES } from "../utils/date.js";
import { runFinancialTransaction } from "../utils/financialTransaction.js";
import { assertNoScheduleConflict, operationalStatusOf } from "./costume.service.js";
import { cancelActivePaymentsForOrder } from "./payment.service.js";
import { calculateSettlement, getActivePayments, getSuccessfulPayments, summarizeSuccessfulPayments } from "./paymentQuote.service.js";
import { createNotificationOnce, notifyAdmins } from "./notification.service.js";
import { orderNotification } from "./notification-template.js";
import { normalizePhone } from "../utils/phone.js";
import { RENTAL_POLICY, calculateMissingBoxFee } from "../config/rentalPolicy.js";
import { RentalCredit } from "../models/RentalCredit.js";
import { generateRentalOrderCode } from "../utils/orderCode.js";
import { Payment } from "../models/Payment.js";
import { quote as quoteShipping } from "./shipping.service.js";
import { ensureRefund } from "./refund.service.js";
import { addCalendarDays, buildStandardRentalSchedule, resolveStandardPackagePrice } from "./rentalSchedule.service.js";
import { storeConfig } from "../config/store.config.js";
import { quoteRentalTimeline } from "./rentalTimeline.service.js";
import { calculateRentalTransportTimeline } from "./transportTime.service.js";
import { createRentalHold } from "./rentalAvailability.service.js";
import { Reservation } from "../models/Reservation.js";
import { TransportReservation } from "../models/TransportReservation.js";
import { TransportTrip } from "../models/TransportTrip.js";
import { DepositRefund } from "../models/DepositRefund.js";
import { getAllowedRentalOrderActions, getOrderFinancialSnapshot, canCompleteOrder, canDispatchHomeDelivery, canStartRental } from "./rentalOrderFinancialPolicy.service.js";
import { releaseVoucherForOrder, reserveVoucherForOrder, voucherSnapshot } from "./voucher.service.js";

const DEFAULT_POLICY_VERSION = RENTAL_POLICY.policyVersion;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let rentalTransactionsSupported;

const statusAliases = {
  pending_confirmation: "pending",
  deposited: "deposit_paid",
  paid: "deposit_paid",
  fully_paid: "deposit_paid",
  ready_for_pickup: "ready_to_pickup",
  cancelled: "canceled",
  rejected: "canceled"
};

function canonicalStatuses(statuses) {
  return statuses.flatMap((status) => [
    status,
    ...Object.entries(statusAliases)
      .filter(([, canonical]) => canonical === status)
      .map(([alias]) => alias)
  ]);
}

async function rollbackDraftOrder(orderId) {
  await Promise.all([
    TransportTrip.deleteMany({ orderId }),
    TransportReservation.deleteMany({ orderId }),
    Reservation.deleteMany({ orderId }),
    RentalOrderItem.deleteMany({ orderId }),
    RentalOrder.deleteOne({ _id: orderId })
  ]);
}

async function paginate(query, { page = 1, limit = 10 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const total = await query.model.countDocuments(query.getFilter());
  const items = await populateOrder(
    query.skip((safePage - 1) * safeLimit).limit(safeLimit)
  );

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

function validateRentalDates(rentalDate, returnDate) {
  const start = parseLocalDateTime(rentalDate);
  const end = parseLocalDateTime(returnDate);

  if (!start || Number.isNaN(start.getTime())) {
    throw new ApiError(400, "Ngày thuê không hợp lệ.");
  }
  if (!end || Number.isNaN(end.getTime())) {
    throw new ApiError(400, "Ngày trả không hợp lệ.");
  }
  if (isPastDate(start)) {
    throw new ApiError(400, "Ngày thuê không được là ngày trong quá khứ.");
  }
  if (end < start) {
    throw new ApiError(400, "Ngày trả phải lớn hơn hoặc bằng ngày thuê.");
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateInvoice(payload = {}, fallbackEmail = "") {
  const invoice = payload.invoice || {};
  const requested = Boolean(invoice.requested);
  const email = normalizeEmail(invoice.email || fallbackEmail);

  if (requested && !EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, "Vui lòng nhập email nhận hóa đơn hợp lệ.");
  }

  return {
    requested,
    email: requested ? email : "",
    status: requested ? "pending" : "not_requested"
  };
}

function normalizeGuestCustomerInfo(payload = {}) {
  const info = payload.customerInfo || {};
  const fullName = String(info.fullName || info.name || "").trim();
  const phone = String(info.phone || "").trim();
  const phoneNormalized = normalizePhone(phone);
  const email = normalizeEmail(info.email);

  if (!fullName) {
    throw new ApiError(400, "Vui lòng nhập họ và tên.");
  }
  if (!phoneNormalized) {
    throw new ApiError(400, "Vui lòng nhập số điện thoại.");
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, "Email không hợp lệ.");
  }

  return {
    fullName,
    phone,
    phoneNormalized,
    email,
    invoice: validateInvoice(payload, email)
  };
}

function normalizeAuthenticatedCustomerInfo(user, payload = {}) {
  const info = payload.customerInfo || {};
  const fullName = String(
    info.fullName || info.name || user?.name || ""
  ).trim();
  const phone = String(info.phone || user?.phone || "").trim();
  const phoneNormalized = normalizePhone(phone);
  const email = normalizeEmail(info.email || user?.email);

  if (!fullName) {
    throw new ApiError(400, "Vui lòng nhập họ và tên.");
  }
  if (!phoneNormalized) {
    throw new ApiError(400, "Vui lòng nhập số điện thoại.");
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, "Email không hợp lệ.");
  }

  return {
    fullName,
    phone,
    phoneNormalized,
    email,
    isGuest: Boolean(user?.isGuest),
    phoneVerified: Boolean(user?.phoneVerified),
    invoice: validateInvoice(payload, email)
  };
}

function normalizeCreateOrderPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new ApiError(400, "Dữ liệu tạo đơn không hợp lệ.");
  }

  const canonicalRequest = Boolean(rawPayload.requestedStartAt || rawPayload.pickupMethod || rawPayload.returnMethod);
  const standardSchedule = !canonicalRequest && rawPayload.mainUseDate ? buildStandardRentalSchedule({ ...rawPayload, fulfillmentMethod: rawPayload.fulfillment?.fulfillmentMethod || rawPayload.fulfillmentMethod }, 0) : null;
  const rentalDate = standardSchedule?.pickupAt || rawPayload.requestedStartAt || rawPayload.rentalDate;
  const rentalDays = standardSchedule ? 2 + standardSchedule.extraDays : Number(rawPayload.rentalDays || 1);
  const pickupMethod = rawPayload.pickupMethod || rawPayload.fulfillment?.pickupMethod || "store_pickup";
  const returnMethod = rawPayload.returnMethod || rawPayload.fulfillment?.returnMethod || "store_return";

  if (pickupMethod === "home_delivery" && rawPayload.paymentPreference === "cash") {
    const error = new ApiError(422, "Không hỗ trợ thanh toán tiền thuê bằng tiền mặt khi giao tận nơi.");
    error.code = "RENTAL_CASH_HOME_DELIVERY_FORBIDDEN";
    throw error;
  }
  if ((pickupMethod === "home_delivery" || returnMethod === "home_collection") && rawPayload.externalCarrierFeeAccepted !== true) {
    const error = new ApiError(422, "Bạn cần xác nhận phí giao/nhận được thanh toán trực tiếp cho shipper và không nằm trong đơn thuê.");
    error.code = "EXTERNAL_CARRIER_FEE_ACK_REQUIRED";
    throw error;
  }

  if (!rentalDate) {
    throw new ApiError(400, "Vui lòng chọn ngày thuê.");
  }
  if (!Number.isInteger(rentalDays) || rentalDays < 1 || rentalDays > 365) {
    throw new ApiError(400, "Thời lượng thuê không hợp lệ.");
  }
  if (!Array.isArray(rawPayload.items) || rawPayload.items.length === 0) {
    throw new ApiError(400, "Đơn thuê phải có ít nhất một trang phục.");
  }
  if (rawPayload.policyAccepted !== true) {
    throw new ApiError(
      400,
      "Bạn cần đọc và đồng ý với chính sách thuê đồ của ARA."
    );
  }

  const items = rawPayload.items.map((item, index) => {
    const costumeId = item?.costumeId;
    const quantity = Number(item?.quantity ?? 1);

    if (!mongoose.isValidObjectId(costumeId)) {
      throw new ApiError(
        400,
        `Trang phục ở vị trí ${index + 1} không hợp lệ.`
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new ApiError(
        400,
        `Số lượng trang phục ở vị trí ${index + 1} không hợp lệ.`
      );
    }

    return {
      costumeId: String(costumeId),
      quantity
    };
  });

  const returnDate = standardSchedule?.expectedReturnAt || (canonicalRequest
    ? new Date(parseLocalDateTime(rentalDate).getTime() + rentalDays * 24 * 3600000)
    : calculateRentalReturnDate(rentalDate, rentalDays));
  validateRentalDates(rentalDate, returnDate);

  return {
    ...rawPayload,
    rentalDate,
    rentalDays,
    returnDate,
    ...(standardSchedule || {}),
    items,
    policyAccepted: true,
    // The server snapshots its current policy; a client cannot select a version.
    policyVersion: DEFAULT_POLICY_VERSION
  };
}

function sessionOptions(session, extra = {}) {
  return session ? { ...extra, session } : extra;
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
}

async function createOrderWithUniqueCode(values, session, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const [order] = await RentalOrder.create([{ ...values, orderCode: generateRentalOrderCode() }], session ? { session } : {});
      return order;
    } catch (error) {
      if (error?.code !== 11000 || !String(Object.keys(error?.keyPattern || error?.keyValue || {})).includes("orderCode") || attempt === attempts - 1) throw error;
    }
  }
  throw new ApiError(500, "Không thể tạo mã đơn thuê.");
}

function mapDatabaseError(error) {
  if (error instanceof ApiError) return error;

  if (isDuplicateKeyError(error)) {
    const duplicatedField = Object.keys(error?.keyValue || {})[0] || "";
    if (duplicatedField.includes("email")) {
      return new ApiError(409, "Email này đã được sử dụng bởi tài khoản khác.");
    }
    if (duplicatedField.includes("phone")) {
      return new ApiError(409, "Số điện thoại này đã được sử dụng.");
    }
    return new ApiError(409, "Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.");
  }

  if (error?.name === "ValidationError") {
    const message = Object.values(error.errors || {})
      .map((item) => item?.message)
      .filter(Boolean)
      .join(", ");
    return new ApiError(400, message || "Dữ liệu tạo đơn không hợp lệ.");
  }

  if (error?.name === "CastError") {
    return new ApiError(400, "Dữ liệu gửi lên không đúng định dạng.");
  }

  return error;
}

async function resolveRentalCustomerLegacy(user, payload, session) {
  if (user?._id) {
    const phoneNormalized = normalizePhone(user.phone);

    return {
      customer: user,

      customerInfo: {
        fullName: user.name || user.fullName || "",
        phone: user.phone || "",
        phoneNormalized,
        email: user.email || "",
        isGuest: Boolean(user.isGuest),
        phoneVerified: Boolean(user.phoneVerified)
      },

      invoice: {
        requested: Boolean(payload.invoice?.requested),

        email: payload.invoice?.requested
          ? String(
            payload.invoice?.email ||
            user.email ||
            ""
          )
            .trim()
            .toLowerCase()
          : "",
        status: payload.invoice?.requested ? "pending" : "not_requested"
      }
    };
  }

  const guestInfo = normalizeGuestCustomerInfo(payload);

  const update = {
    $setOnInsert: {
      phone: guestInfo.phone,
      phoneNormalized: guestInfo.phoneNormalized,
      password: null,
      role: "customer",
      status: "active",
      authMode: "phone_otp",
      isGuest: true,
      phoneVerified: false
    },

    $set: {
      name: guestInfo.fullName
    }
  };

  // Không lưu email rỗng và không đặt email ở cả
  // $set lẫn $setOnInsert.
  if (guestInfo.email) {
    update.$set.email = guestInfo.email;
  }

  let customer;

  try {
    customer = await User.findOneAndUpdate(
      {
        phoneNormalized: guestInfo.phoneNormalized
      },
      update,
      {
        new: true,
        upsert: true,
        session: session || undefined,
        setDefaultsOnInsert: true,
        runValidators: true
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(
        409,
        "Số điện thoại hoặc email đã được sử dụng."
      );
    }

    if (!isTransactionUnsupported(error)) {
      console.error("[resolveRentalCustomer] Failed:", {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        keyValue: error?.keyValue,
        errors: error?.errors
      });
    }

    throw error;
  }

  return {
    customer,

    customerInfo: {
      fullName: customer.name || guestInfo.fullName,
      phone: customer.phone || guestInfo.phone,
      phoneNormalized:
        customer.phoneNormalized ||
        guestInfo.phoneNormalized,
      email: customer.email || guestInfo.email || "",
      isGuest: Boolean(customer.isGuest),
      phoneVerified: Boolean(customer.phoneVerified)
    },

    invoice: guestInfo.invoice
  };
}

async function resolveRentalCustomer(user, payload, session) {
  if (user?._id) return resolveRentalCustomerLegacy(user, payload, session);
  const guest = normalizeGuestCustomerInfo(payload);
  let customer = await User.findOne({ phoneNormalized: guest.phoneNormalized }).session(session || null);
  if (!customer) {
    try {
      const guestUser = {
        name: guest.fullName, phone: guest.phone, phoneNormalized: guest.phoneNormalized,
        password: null, role: "customer", status: "active",
        authMode: "phone_otp", isGuest: true, phoneVerified: false
      };
      if (guest.email) guestUser.email = guest.email;
      [customer] = await User.create([guestUser], session ? { session } : {});
    } catch (error) {
      if (error?.code !== 11000) throw error;
      customer = await User.findOne({ phoneNormalized: guest.phoneNormalized }).session(session || null);
      if (!customer) throw error;
    }
  }
  return {
    customer,
    customerInfo: {
      fullName: guest.fullName, phone: guest.phone, phoneNormalized: guest.phoneNormalized,
      email: guest.email || "", isGuest: Boolean(customer.isGuest),
      phoneVerified: Boolean(customer.phoneVerified)
    },
    invoice: guest.invoice
  };
}

const costumeLocks = new Map();

export async function withCostumeLocks(costumeIds, task) {
  const releases = [];
  for (const key of [...new Set(costumeIds.map(String))].sort()) {
    const previous = costumeLocks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    costumeLocks.set(key, previous.then(() => gate));
    await previous;
    releases.push(release);
  }
  try {
    return await task();
  } finally {
    releases.reverse().forEach((release) => release());
  }
}

async function acquireScheduleLocks(costumeIds, timeoutMs = 8000) {
  const token = new mongoose.Types.ObjectId().toString();
  const acquired = [];
  const deadline = Date.now() + timeoutMs;
  try {
    for (const costumeId of [...new Set(costumeIds.map(String))].sort()) {
      let locked = false;
      while (!locked && Date.now() < deadline) {
        const now = new Date();
        try {
          const result = await CostumeScheduleLock.findOneAndUpdate(
            { costumeId, $or: [{ expiresAt: { $lte: now } }, { token }] },
            { $set: { token, expiresAt: new Date(Date.now() + 60000) }, $setOnInsert: { costumeId } },
            { upsert: true, new: true }
          );
          locked = result?.token === token;
        } catch (error) {
          if (error?.code !== 11000) throw error;
        }
        if (!locked) await new Promise((resolve) => setTimeout(resolve, 40));
      }
      if (!locked) throw new ApiError(409, "Lịch thuê đang được một yêu cầu khác cập nhật. Vui lòng thử lại.");
      acquired.push(costumeId);
    }
    return { token, costumeIds: acquired };
  } catch (error) {
    await CostumeScheduleLock.deleteMany({ token });
    throw error;
  }
}

async function releaseScheduleLocks(lock) {
  if (lock?.token) await CostumeScheduleLock.deleteMany({ token: lock.token });
}

function isTransactionUnsupported(error) {
  const message = String(error?.message || "").toLowerCase();
  return [
    "transaction numbers are only allowed",
    "replica set member or mongos",
    "transactions are not supported",
    "transaction is not supported"
  ].some((part) => message.includes(part));
}

export function populateOrder(query) {
  return query
    .populate({ path: "customerId", select: "-password", strictPopulate: false })
    .populate({
      path: "items",
      strictPopulate: false,
      populate: {
        path: "costumeId",
        strictPopulate: false,
        populate: {
          path: "categoryId",
          strictPopulate: false
        }
      }
    })
    .populate({ path: "payments", strictPopulate: false })
    .populate({ path: "latestPaymentId", strictPopulate: false })
    .populate({ path: "depositPaymentId", strictPopulate: false })
    .populate({ path: "fullPaymentId", strictPopulate: false })
    .populate({ path: "penaltyPaymentId", strictPopulate: false })
    .populate({ path: "refundPaymentId", strictPopulate: false })
    .populate({ path: "inspection", strictPopulate: false });
}

export async function expirePendingOrders({ orderId = null, customerId = null } = {}) {
  const now = new Date();
  let expiredCount = 0;

  while (true) {
    const filter = {
      // Luồng hiện tại tự động xác nhận đơn ngay khi tạo. Vì vậy đơn chưa
      // thanh toán ở trạng thái confirmed cũng phải hết hạn và nhả lịch.
      status: { $in: [...new Set([...canonicalStatuses(["pending"]), "pending_payment", "confirmed"])] },
      $or: [
        { paymentStatus: { $in: ["pending", "unpaid", "awaiting_payment"] } },
        { paymentStatus: { $exists: false } }
      ],
      holdExpiresAt: { $ne: null, $lte: now }
    };
    if (orderId) filter._id = orderId;
    if (customerId) filter.customerId = customerId;

    const expiredOrder = await RentalOrder.findOneAndUpdate(
      filter,
      { $set: { status: "expired", bookingStatus: "cancelled", paymentStatus: "expired", expiredAt: now } },
      { new: true }
    );
    if (!expiredOrder) break;

    await Promise.all([
      Reservation.updateMany({ orderId: expiredOrder._id, status: "held" }, { $set: { status: "expired" } }),
      TransportReservation.updateMany({ orderId: expiredOrder._id, status: "held" }, { $set: { status: "expired" } }),
      releaseVoucherForOrder(expiredOrder._id, "order_expired")
    ]);

    await createNotificationOnce({
      recipientId: expiredOrder.customerId,
      recipientRole: "customer",
      title: "Đơn thuê đã hết thời gian giữ chỗ",
      message: "Đơn thuê không được xác nhận trong thời gian giữ chỗ nên đã hết hạn. Lịch thuê đã được giải phóng và bạn có thể tạo đơn mới.",
      entityType: "rental_order",
      entityId: expiredOrder._id,
      orderId: expiredOrder._id,
      actionUrl: `/my-rentals/${expiredOrder._id}`,
      type: "rental_order_expired",
      priority: "normal",
      eventKey: `order:${expiredOrder._id}:expired:customer`
    });

    expiredCount += 1;
    if (orderId) break;
  }

  return expiredCount;
}

export async function decorateOrder(orderId) {
  await expirePendingOrders({ orderId });
  const document = await populateOrder(RentalOrder.findById(orderId));
  if (!document) return null;
  const order = document.toObject({ virtuals: true });
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const refunds = await DepositRefund.find({ orderId }).sort({ createdAt: -1 }).lean();
  const financialSnapshot = getOrderFinancialSnapshot(order, payments, refunds);
  const actionProjection = getAllowedRentalOrderActions({ order, financial: financialSnapshot });
  const successfulPayments = payments.filter((payment) => payment?.status === "success");
  const paidAmount = successfulPayments
    .filter((payment) => payment.paymentType !== "refund")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refundedAmount = successfulPayments
    .filter((payment) => payment.paymentType === "refund")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const shipping = order.fulfillment || {};
  const totalPenalty = Number(order.lateFee || 0) + Number(order.damageFee || 0);
  const totalDue = Number(order.totalRentalPrice || 0) + totalPenalty + Number(order.totalDepositAmount || 0);
  const extraDays = Math.max(0, Number(order.extraDays || 0));
  const extraDayDates = order.mainUseDate
    ? Array.from({ length: extraDays }, (_, index) => addCalendarDays(order.mainUseDate, index + 1))
    : [];

  return {
    ...order,
    refundDestinationSnapshot: order.refundDestinationSnapshot ? {
      ...order.refundDestinationSnapshot,
      accountNumber: undefined,
      encryptedAccountNumber: undefined,
      maskedAccountNumber: order.refundDestinationSnapshot.maskedAccountNumber || `••••••${String(order.refundDestinationSnapshot.accountNumber || "").slice(-4)}`
    } : null,
    needsRefundInformation: !order.refundDestinationSnapshot?.bankBin || !order.refundDestinationSnapshot?.maskedAccountNumber,
    latestRefund: refunds[0] ? {
      id: String(refunds[0]._id),
      refundCode: refunds[0].refundCode,
      status: refunds[0].status,
      amount: refunds[0].amount
    } : null,
    financialSnapshot,
    ...actionProjection,
    legacyPaymentStatus: order.paymentStatus,
    paymentStatus: ({
      unpaid: "unpaid",
      pending: "pending",
      awaiting_payment: "pending",
      awaiting_confirmation: "awaiting_verification",
      awaiting_verification: "awaiting_verification",
      deposited: "partially_paid",
      deposit_paid: "partially_paid",
      partially_paid: "partially_paid",
      paid: "paid",
      fully_paid: "paid",
      failed: "failed",
      expired: "expired",
      refunded: "refunded"
    }[order.paymentStatus] || order.paymentStatus),
    bookingStatus: order.bookingStatus || ({
      pending: "payment_pending",
      pending_confirmation: "payment_pending",
      confirmed: "confirmed",
      deposit_paid: "confirmed",
      ready_to_pickup: "ready",
      ready_for_pickup: "ready",
      renting: "rented",
      returned: "returned",
      completed: "completed",
      canceled: "cancelled",
      cancelled: "cancelled",
      expired: "cancelled",
      rejected: "cancelled"
    }[order.status] || "confirmed"),
    schedule: {
      rentalDays: Number(order.rentalDays || order.totalHoldDays || 1),
      rentalDurationHours: Number(order.rentalDurationHours || (order.rentalDays || order.totalHoldDays || 1) * 24),
      pickupMethod: order.pickupMethod || "store_pickup",
      returnMethod: order.returnMethod || "store_return",
      plannedRentalStartAt: order.plannedRentalStartAt || order.rentalDate || null,
      plannedRentalEndAt: order.plannedRentalEndAt || order.returnDate || null,
      deliveryDispatchAt: order.deliveryDispatchAt || null,
      expectedDeliveryAt: order.expectedDeliveryAt || null,
      collectionAt: order.collectionAt || null,
      expectedReturnedToStoreAt: order.expectedReturnedToStoreAt || order.returnDate || null,
      customerPossessionStartAt: order.rentalStartedAt || order.actualRentalStartAt || null,
      customerPossessionEndAt: order.billableRentalEndAt || null,
      blockedStartAt: order.blockedStartAt || order.blockedFrom || order.rentalDate || null,
      blockedEndAt: order.blockedEndAt || order.blockedUntil || order.returnDate || null,
      preparationMinutes: Number(order.preparationMinutes || 0),
      inspectionMinutes: Number(order.inspectionMinutes || 0),
      cleaningMinutes: Number(order.cleaningMinutes || 0),
      standardPackageDays: order.standardPackageDays || (order.mainUseDate ? 3 : null),
      standardPackageNights: order.standardPackageNights || (order.mainUseDate ? 2 : null),
      mainUseDate: order.mainUseDate || null,
      pickupAt: order.rentalDate || null,
      expectedReturnAt: order.returnDate || null,
      extraDays,
      extraDayDates,
      totalHoldDays: order.totalHoldDays || null,
      totalHoldNights: order.totalHoldNights || null,
      cleaningUntil: order.cleaningUntil || null,
      blockedFrom: order.blockedFrom || null,
      blockedUntil: order.blockedUntil || null,
      legacySchedule: Boolean(order.legacySchedule || !order.mainUseDate)
    },
    pricing: {
      baseRentalAmount: order.baseRentalAmount ?? null,
      plannedExtraDayFee: order.plannedExtraDayFee ?? null,
      extraDayRatePercent: order.mainUseDate ? 10 : null,
      totalRentalPrice: Number(order.totalRentalPrice || 0),
      outboundFee: 0,
      returnFee: 0,
      totalShippingFee: 0,
      deliveryFee: 0,
      collectionFee: 0,
      lateFee: Number(order.lateFee || 0),
      damageFee: Number(order.damageFee || 0),
      totalPenalty,
      totalDepositAmount: Number(order.totalDepositAmount || 0),
      paidAmount,
      refundedAmount,
      remainingAmount: Math.max(0, totalDue - paidAmount),
      refundableDeposit: Number(order.settlement?.refundAmount || order.refundAmount || 0),
      totalAmountToCollect: totalDue
    }
  };
}

async function notifyOrderCreated(order) {
  try {
    await createNotificationOnce({
      recipientId: order.customerId,
      recipientRole: "customer",
      ...orderNotification("created_customer", order),
      eventKey: `order:${order._id}:created:customer`
    });

    await notifyAdmins({
      ...orderNotification("created_admin", order),
      eventKey: `order:${order._id}:created:admin`
    });
  } catch (error) {
    // Không để lỗi notification làm request tạo đơn trả 500 sau khi đơn đã lưu.
    console.error("[rental-order] Không thể gửi thông báo tạo đơn:", {
      orderId: String(order?._id || ""),
      message: error?.message,
      stack: error?.stack
    });
  }
}

export async function createRentalOrder(userOrCustomerId, rawPayload) {
  try {
    if (mongoose.connection.$araTransactionsSupported === false) rentalTransactionsSupported = false;
    const payload = normalizeCreateOrderPayload(rawPayload);
    if (payload.idempotencyKey) {
      const existing = await RentalOrder.findOne({ idempotencyKey: payload.idempotencyKey });
      if (existing) return decorateOrder(existing._id);
    }
    const user =
      userOrCustomerId &&
        typeof userOrCustomerId === "object" &&
        userOrCustomerId._id
        ? userOrCustomerId
        : null;
    const legacyCustomerId =
      !user && userOrCustomerId ? userOrCustomerId : null;

    const quantityByCostume = new Map();
    for (const item of payload.items) {
      const key = String(item.costumeId);
      quantityByCostume.set(
        key,
        (quantityByCostume.get(key) || 0) + item.quantity
      );
    }

    const normalizedInputs = [...quantityByCostume.entries()].map(
      ([costumeId, quantity]) => ({ costumeId, quantity })
    );
    const costumeIds = normalizedInputs.map((item) => item.costumeId);

    return await withCostumeLocks(costumeIds, async () => {
      const scheduleLock = await acquireScheduleLocks(costumeIds);

      try {
        const performCreate = async (session = null) => {
          let effectiveUser = user;

          if (legacyCustomerId) {
            const userQuery = User.findById(legacyCustomerId);
            if (session) userQuery.session(session);
            effectiveUser = await userQuery;

            if (!effectiveUser) {
              throw new ApiError(
                400,
                "Không tìm thấy thông tin khách hàng."
              );
            }
          }

          const resolvedCustomer = await resolveRentalCustomer(
            effectiveUser,
            payload,
            session
          );

          if (!resolvedCustomer.customer?._id) {
            throw new ApiError(
              400,
              "Không tìm thấy thông tin khách hàng."
            );
          }

          const customerId = resolvedCustomer.customer._id;
          const shippingQuote = await quoteShipping(effectiveUser, {
            ...(payload.fulfillment || {}),
            pickupMethod: payload.pickupMethod || payload.fulfillment?.pickupMethod,
            returnMethod: payload.returnMethod || payload.fulfillment?.returnMethod,
            fulfillmentMethod: payload.fulfillment?.fulfillmentMethod || payload.fulfillmentMethod,
            deliveryAddress: payload.deliveryAddress || payload.fulfillment?.deliveryAddress,
            collectionAddress: payload.collectionAddress || payload.fulfillment?.collectionAddress,
            collectionSameAsDelivery: payload.collectionSameAsDelivery ?? payload.fulfillment?.collectionSameAsDelivery
          });
          const resolvedTransportTimeline = shippingQuote.zone && (shippingQuote.pickupMethod === "home_delivery" || shippingQuote.returnMethod === "home_collection")
            ? calculateRentalTransportTimeline({
                ...payload,
                pickupMethod: payload.pickupMethod || shippingQuote.pickupMethod,
                returnMethod: payload.returnMethod || shippingQuote.returnMethod,
                requestedPickupOrDeliveryAt: payload.requestedStartAt || payload.rentalDate,
                zone: shippingQuote.zone
              })
            : null;
          const canonicalTimeline = payload.requestedStartAt || payload.pickupMethod || payload.returnMethod
            ? quoteRentalTimeline({
                ...payload,
                pickupMethod: payload.pickupMethod || shippingQuote.pickupMethod,
                returnMethod: payload.returnMethod || shippingQuote.returnMethod,
                requestedStartAt: payload.requestedStartAt || payload.rentalDate
              }, {
                outboundTransportMinutes: resolvedTransportTimeline?.outbound?.effectiveDurationMinutes || 0,
                inboundTransportMinutes: resolvedTransportTimeline?.inbound?.effectiveDurationMinutes || 0
              })
            : null;
          const rentalDate = canonicalTimeline?.plannedRentalStartAt || parseLocalDateTime(payload.rentalDate);
          const returnDate = canonicalTimeline?.plannedRentalEndAt || parseLocalDateTime(payload.returnDate) || calculateRentalReturnDate(rentalDate, payload.rentalDays);
          validateRentalDates(rentalDate, returnDate);

          let totalRentalPrice = 0;
          let totalDepositAmount = 0;
          const preparedItems = [];

          for (const input of normalizedInputs) {
            const costume = await Costume.findByIdAndUpdate(
              input.costumeId,
              { $inc: { scheduleVersion: 1 } },
              sessionOptions(session, { new: true })
            );

            if (!costume) {
              throw new ApiError(404, "Không tìm thấy trang phục.");
            }
            if (operationalStatusOf(costume) !== "active") {
              throw new ApiError(
                400,
                `${costume.name} hiện không thể đặt thuê.`
              );
            }

            await assertNoScheduleConflict(
              costume._id,
              canonicalTimeline?.blockedStartAt || payload.blockedFrom || rentalDate,
              canonicalTimeline?.blockedEndAt || payload.availabilityUntil || returnDate,
              null,
              session,
              input.quantity
            );

            preparedItems.push({
              costume,
              quantity: input.quantity
            });
          }

          const holdMinutes = storeConfig.pendingPaymentMinutes;
          const holdExpiresAt = new Date(
            Date.now() + holdMinutes * 60 * 1000
          );

          const order = await createOrderWithUniqueCode(
              {
                customerId,
                customerInfo: resolvedCustomer.customerInfo,
                invoice: resolvedCustomer.invoice,

                rentalDate,
                returnDate,
                rentalDays: payload.rentalDays,
                rentalDurationHours: payload.rentalDays * 24,
                pickupMethod: canonicalTimeline?.pickupMethod || shippingQuote.pickupMethod || "store_pickup",
                returnMethod: canonicalTimeline?.returnMethod || shippingQuote.returnMethod || "store_return",
                source: ["online", "walk_in", "admin"].includes(payload.source) ? payload.source : "online",
                idempotencyKey: payload.idempotencyKey || null,
                quoteId: payload.quoteId || canonicalTimeline?.quoteId || "",
                quoteVersion: Number(payload.quoteVersion || canonicalTimeline?.quoteVersion || 1),
                plannedRentalStartAt: canonicalTimeline?.plannedRentalStartAt || rentalDate,
                plannedRentalEndAt: canonicalTimeline?.plannedRentalEndAt || returnDate,
                deliveryDispatchAt: canonicalTimeline?.deliveryDispatchAt || null,
                expectedDeliveryAt: canonicalTimeline?.expectedDeliveryAt || null,
                collectionAt: canonicalTimeline?.collectionAt || null,
                expectedReturnedToStoreAt: canonicalTimeline?.expectedReturnedToStoreAt || returnDate,
                blockedStartAt: canonicalTimeline?.blockedStartAt || payload.blockedFrom || rentalDate,
                blockedEndAt: canonicalTimeline?.blockedEndAt || payload.blockedUntil || returnDate,
                preparationMinutes: canonicalTimeline?.preparationMinutes ?? storeConfig.preparationMinutes,
                inspectionMinutes: canonicalTimeline?.inspectionMinutes ?? storeConfig.inspectionMinutes,
                cleaningMinutes: canonicalTimeline?.cleaningMinutes ?? storeConfig.defaultCleaningMinutes,
                outboundTransportMinutes: canonicalTimeline?.outboundTransportMinutes || 0,
                inboundTransportMinutes: canonicalTimeline?.inboundTransportMinutes || 0,
                transportZoneId: shippingQuote.zone?._id || null,
                transportQuoteVersion: Number(shippingQuote.zone?.quoteVersion || 1),
                transportQuoteSnapshot: shippingQuote.zone ? {
                  zoneId: shippingQuote.zone._id,
                  zoneVersion: shippingQuote.zone.version || shippingQuote.zone.quoteVersion || 1,
                  deliveryFee: shippingQuote.outboundFee,
                  collectionFee: shippingQuote.returnFee,
                  outbound: resolvedTransportTimeline?.outbound ? {
                    ...resolvedTransportTimeline.outbound,
                    dispatchAt: resolvedTransportTimeline.deliveryDispatchAt,
                    expectedDeliveryAt: resolvedTransportTimeline.expectedDeliveryAt
                  } : null,
                  inbound: resolvedTransportTimeline?.inbound ? {
                    ...resolvedTransportTimeline.inbound,
                    collectionAt: resolvedTransportTimeline.collectionAt,
                    expectedReturnedToStoreAt: resolvedTransportTimeline.expectedReturnedToStoreAt
                  } : null,
                  calculatedAt: new Date(),
                  expiresAt: holdExpiresAt
                } : null,
                deliveryFee: shippingQuote.outboundFee,
                collectionFee: shippingQuote.returnFee,
                mainUseDate: payload.mainUseDate || "",
                extraDays: Number(payload.extraDays || 0),
                standardPackageDays: payload.mainUseDate ? 3 : 0,
                standardPackageNights: payload.mainUseDate ? 2 : 0,
                totalHoldDays: payload.mainUseDate ? 3 + Number(payload.extraDays || 0) : 0,
                totalHoldNights: payload.mainUseDate ? 2 + Number(payload.extraDays || 0) : 0,
                cleaningUntil: payload.cleaningUntil || new Date(returnDate.getTime() + RENTAL_TURNAROUND_MINUTES * 60000),
                blockedFrom: payload.blockedFrom || rentalDate,
                blockedUntil: payload.blockedUntil || payload.cleaningUntil || new Date(returnDate.getTime() + RENTAL_TURNAROUND_MINUTES * 60000),
                legacySchedule: !payload.mainUseDate,
                holdExpiresAt,
                paymentExpiresAt: holdExpiresAt,

                policyAccepted: payload.policyAccepted === true,
                policyVersion:
                  DEFAULT_POLICY_VERSION,
                policyAcceptedAt: new Date(),

              status: "pending_payment",
                bookingStatus: "payment_pending",
                paymentStatus: "unpaid",
                approvalMode: "automatic",
                approvedAt: null,
                approvedBy: null,
                paymentPreference: ["cash", "bank_transfer", "payos"].includes(payload.paymentPreference) ? payload.paymentPreference : "bank_transfer",
                paymentMethod: ["cash", "bank_transfer", "payos"].includes(payload.paymentPreference) ? payload.paymentPreference : "bank_transfer",
                shipping: { outboundFee: 0, returnFee: 0, totalFee: 0 },
                fulfillment: {
                  method: shippingQuote.fulfillmentMethod,
                  receiverSnapshot: shippingQuote.receiver || { fullName: resolvedCustomer.customerInfo.fullName, phone: resolvedCustomer.customerInfo.phone },
                  deliveryAddressSnapshot: shippingQuote.deliveryAddress || {},
                  collectionAddressSnapshot: shippingQuote.collectionAddress || {},
                  outbound: { fee: 0, status: shippingQuote.fulfillmentMethod === "store_pickup" ? "not_required" : "pending", scheduledFrom: payload.fulfillment?.outbound?.scheduledFrom || null, scheduledTo: payload.fulfillment?.outbound?.scheduledTo || null },
                  returnTrip: { fee: 0, status: shippingQuote.fulfillmentMethod === "two_way_delivery" ? "pending" : "not_required", scheduledFrom: payload.fulfillment?.returnTrip?.scheduledFrom || null, scheduledTo: payload.fulfillment?.returnTrip?.scheduledTo || null },
                  totalFee: 0
                },
                note: payload.note || ""
              },
            session
          );

          try {
            const items = preparedItems.map(({ costume, quantity }) => {
            const rentalPricePerDay = Math.max(0, Number(costume.rentalPricePerDay || 0));
            const standardPackagePrice = resolveStandardPackagePrice(costume);
            const depositAmount = Math.max(
              0,
              Number(costume.depositAmount || 0)
            );
            const pricing = payload.mainUseDate
              ? buildStandardRentalSchedule(payload, standardPackagePrice).pricing
              : rentalPriceBreakdown(rentalDate, returnDate, rentalPricePerDay);
            const subtotal = Number(payload.mainUseDate ? pricing.totalRentalAmount : pricing.total || 0) * quantity;

            if (!Number.isFinite(subtotal)) {
              throw new ApiError(
                400,
                `Giá thuê của ${costume.name} không hợp lệ.`
              );
            }

            totalRentalPrice += subtotal;
            totalDepositAmount += depositAmount * quantity;

            return {
              orderId: order._id,
              costumeId: costume._id,
              quantity,
              rentalPricePerDay,
              depositAmount,
              subtotal
            };
          });

          const createdItems = await RentalOrderItem.insertMany(
            items,
            sessionOptions(session, { ordered: true })
          );

          if (canonicalTimeline) {
            await createRentalHold({
              orderId: order._id,
              orderItems: createdItems.map((item) => ({
                orderItemId: item._id,
                costumeId: item.costumeId,
                quantity: item.quantity
              })),
              timeline: canonicalTimeline,
              source: order.source,
              expiresAt: holdExpiresAt,
              staffId: order.source === "online" ? null : effectiveUser?._id,
              zone: shippingQuote.zone,
              session
            });
          }

          const grossRentalAmount = totalRentalPrice;
          let discountAmount = 0;
          let reservedVoucher = null;
          if (payload.voucherCode) {
            const voucherItems = items.map((item, index) => ({
              ...item,
              costume: preparedItems[index].costume
            }));
            reservedVoucher = await reserveVoucherForOrder({
              code: payload.voucherCode,
              customerId,
              customerInfo: resolvedCustomer.customerInfo,
              items: voucherItems,
              rentalAmount: grossRentalAmount,
              currentOrderId: order._id,
              orderId: order._id,
              idempotencyKey: payload.idempotencyKey || null,
              session
            });
            discountAmount = reservedVoucher.discountAmount;
            order.voucher = voucherSnapshot(reservedVoucher);
          }
          order.grossRentalAmount = grossRentalAmount;
          order.discountAmount = discountAmount;
          order.totalRentalPrice = Math.max(0, grossRentalAmount - discountAmount);
          order.baseRentalAmount = preparedItems.reduce((sum, entry) => sum + resolveStandardPackagePrice(entry.costume) * entry.quantity, 0);
          order.plannedExtraDayFee = payload.mainUseDate ? grossRentalAmount - order.baseRentalAmount : 0;
          order.totalDepositAmount = totalDepositAmount;
          order.finalAmount = order.totalRentalPrice + totalDepositAmount;
          try {
            await order.save(sessionOptions(session));
          } catch (saveError) {
            if (!session && reservedVoucher) await releaseVoucherForOrder(order._id, "order_creation_failed");
            throw saveError;
          }

            return order;
          } catch (error) {
            if (!session) {
              try {
                await rollbackDraftOrder(order._id);
              } catch {
                // Keep the original creation or reservation error for the caller.
              }
            }
            throw error;
          }
        };

        if (rentalTransactionsSupported === false) {
          const createdOrder = await performCreate(null);
          await notifyOrderCreated(createdOrder);
          return decorateOrder(createdOrder._id);
        }

        const session = await mongoose.startSession();
        let createdOrder;

        try {
          try {
            await session.withTransaction(async () => {
              createdOrder = await performCreate(session);
            });
            rentalTransactionsSupported = true;
          } catch (error) {
            if (!isTransactionUnsupported(error)) {
              throw error;
            }

            rentalTransactionsSupported = false;
            console.warn("[database] MongoDB standalone: các lần tạo đơn tiếp theo sẽ bỏ qua transaction.");

            createdOrder = await performCreate(null);
          }
        } finally {
          await session.endSession();
        }

        if (!createdOrder?._id) {
          throw new ApiError(500, "Không thể tạo đơn thuê.");
        }

        await notifyOrderCreated(createdOrder);
        return decorateOrder(createdOrder._id);
      } finally {
        await releaseScheduleLocks(scheduleLock);
      }
    });
  } catch (error) {
    const mappedError = mapDatabaseError(error);

    console.error("[rental-order] Tạo đơn thất bại:", {
      statusCode: mappedError?.statusCode || mappedError?.status,
      name: mappedError?.name,
      message: mappedError?.message,
      code: error?.code,
      keyValue: error?.keyValue,
      errors: error?.errors,
      stack: error?.stack
    });

    throw mappedError;
  }
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildMyOrderFilter(customerId, params = {}) {
  const filter = { customerId };
  if (params.status) filter.status = { $in: canonicalStatuses([params.status]) };

  const search = String(params.search || "").trim();
  if (!search) return filter;
  const regex = new RegExp(escapeRegex(search), "i");
  const costumes = await Costume.find({ name: regex }).select("_id");
  const orderIds = await RentalOrderItem.find({
    costumeId: { $in: costumes.map((costume) => costume._id) }
  }).distinct("orderId");
  filter.$or = [
    { _id: { $in: orderIds } },
    { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: escapeRegex(search), options: "i" } } }
  ];
  return filter;
}

export async function listMyOrders(customerId, params) {
  await expirePendingOrders({ customerId });
  const filter = await buildMyOrderFilter(customerId, params);
  return paginate(RentalOrder.find(filter).sort({ createdAt: -1 }), params);
}

export async function listAdminOrders(params) {
  await expirePendingOrders();
  const filter = {};
  let allowedStatuses = null;
  const intersectStatuses = (statuses) => {
    const next = new Set(canonicalStatuses(statuses));
    allowedStatuses = allowedStatuses ? allowedStatuses.filter((status) => next.has(status)) : [...next];
  };
  if (params.workflow === "inspection") {
    intersectStatuses(["renting", "overdue", "returned"]);
  }
  if (params.status === "returned_pending") {
    intersectStatuses(["returned"]);
    filter.inspectedAt = null;
  } else if (params.status === "returned_inspected") {
    intersectStatuses(["returned"]);
    filter.inspectedAt = { $ne: null };
  } else if (params.status) {
    intersectStatuses([params.status]);
  }
  if (params.paymentStatus) filter.paymentStatus = params.paymentStatus;
  if (params.pickupMethod) filter.pickupMethod = params.pickupMethod;
  if (params.returnMethod) filter.returnMethod = params.returnMethod;
  if (params.source) filter.source = params.source;
  if (params.rentalDays) filter.rentalDays = Number(params.rentalDays);
  if (params.extraDays === "yes") filter.extraDays = { $gt: 0 };
  if (params.extraDays === "no") filter.extraDays = { $in: [0, null] };
  if (String(params.overdue || "") === "true") intersectStatuses(["overdue"]);
  if (allowedStatuses) filter.status = { $in: allowedStatuses };
  const rangeField = {
    pickup: "rentalDate",
    main: "mainUseDate",
    return: "returnDate"
  }[params.dateField] || "rentalDate";
  if (params.dateFrom || params.dateTo) {
    filter[rangeField] = {};
    const parseRangeValue = (value, endOfDay = false) => rangeField === "mainUseDate"
      ? String(value).slice(0, 10)
      : parseLocalDateTime(value, { endOfDay });
    if (params.dateFrom) filter[rangeField].$gte = parseRangeValue(params.dateFrom);
    if (params.dateTo) filter[rangeField].$lte = parseRangeValue(params.dateTo, true);
  }
  const search = String(params.search || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const [costumes, customers] = await Promise.all([
      Costume.find({ name: regex }).select("_id"),
      User.find({ $or: [{ name: regex }, { phone: regex }, { phoneNormalized: regex }] }).select("_id")
    ]);
    const orderIds = await RentalOrderItem.find({ costumeId: { $in: costumes.map((item) => item._id) } }).distinct("orderId");
    filter.$or = [
      { _id: { $in: orderIds } },
      { customerId: { $in: customers.map((item) => item._id) } },
      { orderCode: regex },
      { "customerInfo.fullName": regex },
      { "customerInfo.phone": regex }
    ];
  }
  const [result, statusRows] = await Promise.all([
    paginate(RentalOrder.find(filter).sort({ createdAt: -1 }), params),
    RentalOrder.aggregate([
      { $match: filter },
      { $group: {
        _id: params.workflow === "inspection"
          ? { status: "$status", inspected: { $ne: ["$inspectedAt", null] } }
          : "$status",
        count: { $sum: 1 }
      } }
    ])
  ]);
  const statusCounts = {};
  const inspectionCounts = { pending: 0, inspected: 0 };
  for (const row of statusRows) {
    const rawStatus = typeof row._id === "object" ? row._id.status : row._id;
    const key = statusAliases[rawStatus] || rawStatus || "unknown";
    statusCounts[key] = (statusCounts[key] || 0) + Number(row.count || 0);
    if (key === "returned" && typeof row._id === "object") {
      inspectionCounts[row._id.inspected ? "inspected" : "pending"] += Number(row.count || 0);
    }
  }
  return {
    ...result,
    summary: {
      total: result.pagination.total,
      statusCounts,
      ...(params.workflow === "inspection" ? { inspectionCounts } : {})
    }
  };
}

export async function getOrderForUser(orderId, user) {
  const order = await decorateOrder(orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  if (String(order.customerId._id) !== String(user._id) && !isAdminRole(user.role)) {
    throw new ApiError(403, "Bạn không có quyền xem đơn thuê này.");
  }
  return order;
}

export async function cancelOrder(orderId, user) {
  const canceledId = await runFinancialTransaction("hủy đơn thuê", async (session) => {
    const query = RentalOrder.findById(orderId);
    const order = session ? await query.session(session) : await query;
    if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
    const adminActor = isAdminRole(user.role);
    if (adminActor && !hasAdminPermission(user, ADMIN_PERMISSIONS.ORDERS_OVERRIDE)) {
      throw new ApiError(403, "Tài khoản không có quyền hủy đơn thuê.");
    }
    if (String(order.customerId) !== String(user._id) && !adminActor) {
      throw new ApiError(403, "Bạn không có quyền hủy đơn này.");
    }
    if (!["pending_payment", ...canonicalStatuses(["pending", "confirmed"])].includes(order.status)) {
      throw new ApiError(400, "Đơn thuê hiện không còn được phép hủy.");
    }

    // Only pending attempts are canceled. Successful deposits are never marked
    // refunded; before pickup they become an unlimited rental credit instead.
    await cancelActivePaymentsForOrder(order, session);
    const successfulPayments = await getSuccessfulPayments(order._id, session);
    const paidDeposit = summarizeSuccessfulPayments(order, successfulPayments).depositPaidAmount;
    if (paidDeposit > 0 && !order.pickedUpAt) {
      await RentalCredit.updateOne(
        { sourceOrderId: order._id },
        { $setOnInsert: { customerId: order.customerId, originalAmount: paidDeposit, remainingAmount: paidDeposit, status: "available" } },
        { upsert: true, ...(session ? { session } : {}) }
      );
    }
    order.status = "canceled";
    await order.save(session ? { session } : {});
    await releaseVoucherForOrder(order._id, "order_canceled", session);
    await Promise.all([
      Reservation.updateMany({ orderId: order._id, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "cancelled" } }, session ? { session } : {}),
      TransportReservation.updateMany({ orderId: order._id, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "cancelled" } }, session ? { session } : {})
    ]);
    const byAdmin = isAdminRole(user.role);
    if (byAdmin) {
      await createNotificationOnce({
        recipientId: order.customerId,
        recipientRole: "customer",
        ...orderNotification("canceled_customer", order),
        eventKey: `order:${order._id}:canceled:customer`
      }, { session });
    } else {
      await notifyAdmins({
        ...orderNotification("canceled_admin", order),
        eventKey: `order:${order._id}:canceled:admin`
      }, { session });
    }
    return order._id;
  });
  const decorated = await decorateOrder(canceledId);
  emitOrderUpdated({ orderId: decorated._id, customerId: decorated.customerId?._id || decorated.customerId, status: decorated.status, paymentStatus: decorated.paymentStatus, reason: "canceled" });
  return decorated;
}

export async function approveOrder(orderId, adminId) {
  await expirePendingOrders({ orderId });
  const lockItems = await RentalOrderItem.find({ orderId }).select("costumeId");
  return withCostumeLocks(lockItems.map((item) => item.costumeId), async () => {
    const scheduleLock = await acquireScheduleLocks(lockItems.map((item) => item.costumeId));
    try {
      const session = await mongoose.startSession();
      try {
        let order;
        const performApprove = async (sessionArg = null) => {
          order = sessionArg ? await RentalOrder.findById(orderId).session(sessionArg) : await RentalOrder.findById(orderId);
          if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
          if (order.status === "expired") throw new ApiError(409, "Đơn thuê đã hết thời gian giữ chỗ và không thể duyệt. Khách hàng cần tạo đơn mới.");
          if (!["pending_payment", ...canonicalStatuses(["pending"])].includes(order.status)) throw new ApiError(400, "Chỉ được duyệt đơn đang chờ xác nhận.");
          if (order.status === "pending_payment" && !(order.pickupMethod === "store_pickup" && order.paymentPreference === "cash")) throw new ApiError(409, "Đơn chưa có khoản thanh toán hợp lệ để xác nhận.");
          if (order.holdExpiresAt && order.holdExpiresAt <= new Date()) throw new ApiError(409, "Thời gian giữ chỗ của đơn đã hết hạn.");
          const items = sessionArg ? await RentalOrderItem.find({ orderId }).session(sessionArg) : await RentalOrderItem.find({ orderId });
          for (const item of items) {
            if (sessionArg) await Costume.updateOne({ _id: item.costumeId }, { $inc: { scheduleVersion: 1 } }, { session: sessionArg });
            await assertNoScheduleConflict(item.costumeId, order.rentalDate, order.returnDate, order._id, sessionArg, item.quantity);
          }
          order.status = "confirmed";
          order.approvedBy = adminId;
          order.approvedAt = new Date();
          await order.save(sessionArg ? { session: sessionArg } : {});
        };
        try {
          await session.withTransaction(() => performApprove(session));
        } catch (error) {
          if (!isTransactionUnsupported(error)) throw error;
          await performApprove(null);
        }
        const decorated = await decorateOrder(order._id);
        emitOrderUpdated({ orderId: decorated._id, customerId: decorated.customerId?._id || decorated.customerId, status: decorated.status, paymentStatus: decorated.paymentStatus, reason: "approved" });
        await createNotificationOnce({
          recipientId: order.customerId,
          recipientRole: "customer",
          ...orderNotification("approved", order),
          eventKey: `order:${order._id}:approved:customer`
        });
        return decorated;
      } finally {
        await session.endSession();
      }
    } finally {
      await releaseScheduleLocks(scheduleLock);
    }
  });
}

export async function rejectOrder(orderId, adminId, reason) {
  const rejectedId = await runFinancialTransaction("từ chối đơn thuê", async (session) => {
    const query = RentalOrder.findById(orderId);
    const order = session ? await query.session(session) : await query;
    if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
    if (!["pending_payment", ...canonicalStatuses(["pending", "confirmed"])].includes(order.status)) {
      throw new ApiError(400, "Chỉ được hủy đơn đang chờ xác nhận hoặc đã xác nhận.");
    }
    await cancelActivePaymentsForOrder(order, session, "Cửa hàng đã từ chối đơn thuê.");
    order.status = "canceled";
    order.rejectedBy = adminId;
    order.rejectedAt = new Date();
    order.rejectReason = reason || "Cửa hàng không thể nhận đơn trong thời gian này.";
    await order.save(session ? { session } : {});
    await releaseVoucherForOrder(order._id, "order_rejected", session);
    await Promise.all([
      Reservation.updateMany({ orderId: order._id, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "cancelled" } }, session ? { session } : {}),
      TransportReservation.updateMany({ orderId: order._id, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "cancelled" } }, session ? { session } : {})
    ]);
    await createNotificationOnce({
      recipientId: order.customerId,
      recipientRole: "customer",
      ...orderNotification("rejected", order, { reason: order.rejectReason }),
      eventKey: `order:${order._id}:rejected:customer`
    }, { session });
    return order._id;
  });
  const decorated = await decorateOrder(rejectedId);
  emitOrderUpdated({ orderId: decorated._id, customerId: decorated.customerId?._id || decorated.customerId, status: decorated.status, paymentStatus: decorated.paymentStatus, reason: "rejected" });
  return decorated;
}

export async function transitionOrder(orderId, action) {
  const rules = {
    readyForPickup: {
      from: ["confirmed", "deposit_paid"],
      status: "ready_for_handover",
      stamp: "readyForPickupAt"
    },

    pickedUp: {
      from: ["ready_for_handover", "ready_to_pickup"],
      status: "renting",
      stamp: "pickedUpAt"
    },

    returned: {
      from: ["renting", "overdue"],
      status: "returned",
      stamp: "returnedAt"
    }
  };
  const rule = rules[action];
  const order = await RentalOrder.findById(orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  if (action === "pickedUp") {
    if (order.pickupMethod !== "store_pickup") throw new ApiError(409, "Đơn giao tận nơi phải xác nhận đã giao cho shipper và khách đã nhận hàng.");
    if (order.paymentPreference === "cash") throw new ApiError(409, "Vui lòng dùng thao tác xác nhận thu tiền và khách nhận đồ.");
    const payments = await Payment.find({ orderId: order._id }).lean();
    const financial = getOrderFinancialSnapshot(order, payments, []);
    const decision = canStartRental({ order, financial });
    if (!decision.allowed) { const error = new ApiError(409, decision.message); error.code = decision.code; error.data = decision.details; throw error; }
  }
  if (!canonicalStatuses(rule.from).includes(order.status)) throw new ApiError(400, "Trạng thái đơn hiện tại không cho phép thao tác này.");
  order.status = rule.status;
  if (rule.stamp) order[rule.stamp] = new Date();
  if (action === "pickedUp") {
    const startedAt = order.rentalStartedAt || order.pickedUpAt || new Date();
    order.rentalStartedAt = startedAt;
    order.actualRentalStartAt = startedAt;
    order.rentalDueAt ||= new Date(startedAt.getTime() + Number(order.rentalDurationHours || order.rentalDays * 24 || 24) * 3600000);
  }
  if (action === "returned") {
    const returnedAt = new Date();
    order.actualReturnDate = returnedAt;
    order.returnedAt = returnedAt;
    order.actualReturnedToStoreAt = returnedAt;
    order.billableRentalEndAt ||= returnedAt;
    order.turnaroundUntil = new Date(returnedAt.getTime() + RENTAL_TURNAROUND_MINUTES * 60 * 1000);
  }
  await order.save();
  const reservationStatus = action === "readyForPickup"
    ? (order.pickupMethod === "home_delivery" ? "out_for_delivery" : "ready_for_pickup")
    : action === "pickedUp" ? "active"
      : action === "returned" ? "inspection" : null;
  if (reservationStatus) {
    await Reservation.updateMany(
      { orderId: order._id, status: { $nin: ["completed", "cancelled", "expired"] } },
      { $set: {
        status: reservationStatus,
        ...(action === "pickedUp" ? { actualRentalStartAt: order.pickedUpAt } : {}),
        ...(action === "returned" ? { actualReturnedToStoreAt: order.returnedAt, billableRentalEndAt: order.returnedAt } : {})
      } }
    );
  }
  emitOrderUpdated({ orderId: order._id, customerId: order.customerId, status: order.status, paymentStatus: order.paymentStatus, reason: action });
  if (action === "readyForPickup") {
    await createNotificationOnce({ recipientId: order.customerId, recipientRole: "customer", ...orderNotification("ready", order), eventKey: `order:${order._id}:ready_for_pickup:customer` });
  } else if (action === "pickedUp") {
    await createNotificationOnce({ recipientId: order.customerId, recipientRole: "customer", ...orderNotification("picked_up", order), eventKey: `order:${order._id}:picked_up:customer` });
  } else if (action === "returned") {
    await createNotificationOnce({ recipientId: order.customerId, recipientRole: "customer", ...orderNotification("returned_customer", order), eventKey: `order:${order._id}:returned:customer` });
    await notifyAdmins({ ...orderNotification("returned_admin", order), eventKey: `order:${order._id}:inspection_required:admin` });
  }
  return decorateOrder(order._id);
}

function fulfillmentPatch(body = {}) {
  return {
    ...(body.carrierName ? { carrierName: String(body.carrierName).trim() } : {}),
    ...(body.carrierPhone ? { carrierPhone: String(body.carrierPhone).trim() } : {}),
    ...(body.trackingCode ? { trackingCode: String(body.trackingCode).trim() } : {}),
    ...(body.note ? { note: String(body.note).trim() } : {})
  };
}

export async function dispatchHomeDelivery(orderId, body, adminId) {
  const order = await RentalOrder.findById(orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  const payments = await Payment.find({ orderId }).lean();
  const refunds = await DepositRefund.find({ orderId }).lean();
  const financial = getOrderFinancialSnapshot(order, payments, refunds);
  const decision = canDispatchHomeDelivery({ order, financial });
  if (!decision.allowed) { const error = new ApiError(409, decision.message); error.code = decision.code; error.data = decision.details; throw error; }
  const now = new Date();
  const updated = await RentalOrder.findOneAndUpdate(
    { _id: orderId, status: { $in: ["ready_for_handover", "ready_to_pickup", "ready_for_pickup"] }, pickupMethod: "home_delivery", "fulfillment.outbound.handedToCarrierAt": null },
    { $set: { status: "outbound_in_transit", "fulfillment.outbound.status": "out_for_delivery", "fulfillment.outbound.handedToCarrierAt": now, "fulfillment.outbound.startedAt": now, "fulfillment.outbound.confirmedBy": adminId, ...Object.fromEntries(Object.entries(fulfillmentPatch(body)).map(([key, value]) => [`fulfillment.outbound.${key}`, value])) } },
    { new: true }
  );
  if (!updated) throw new ApiError(409, "Đơn đã được xử lý hoặc không còn sẵn sàng giao cho shipper.");
  return decorateOrder(updated._id);
}

export async function confirmCustomerReceived(orderId, body, adminId) {
  const deliveredAt = new Date(body.deliveredAt || Date.now());
  if (Number.isNaN(deliveredAt.getTime()) || deliveredAt > new Date(Date.now() + 5 * 60000)) throw new ApiError(400, "Thời điểm khách nhận hàng không hợp lệ.");
  const order = await RentalOrder.findOne({ _id: orderId, status: "outbound_in_transit", "fulfillment.outbound.deliveredAt": null });
  if (!order) {
    const existing = await RentalOrder.findById(orderId);
    if (existing?.fulfillment?.outbound?.deliveredAt) return decorateOrder(existing._id);
    throw new ApiError(409, "Đơn không ở trạng thái đang giao tới khách.");
  }
  const dueAt = new Date(deliveredAt.getTime() + Number(order.rentalDurationHours || order.rentalDays * 24 || 24) * 3600000);
  const updated = await RentalOrder.findOneAndUpdate(
    { _id: orderId, status: "outbound_in_transit", "fulfillment.outbound.deliveredAt": null },
    { $set: { status: "renting", pickedUpAt: deliveredAt, rentalStartedAt: deliveredAt, actualRentalStartAt: deliveredAt, actualDeliveryAt: deliveredAt, rentalDueAt: dueAt, "schedule.customerReceivedAt": deliveredAt, "fulfillment.outbound.deliveredAt": deliveredAt, "fulfillment.outbound.status": "delivered", "fulfillment.outbound.confirmedBy": adminId, ...Object.fromEntries(Object.entries(fulfillmentPatch(body)).map(([key, value]) => [`fulfillment.outbound.${key}`, value])) } },
    { new: true }
  );
  if (!updated) throw new ApiError(409, "Trạng thái giao hàng vừa được thay đổi. Vui lòng tải lại đơn.");
  await Reservation.updateMany({ orderId, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "active", actualRentalStartAt: deliveredAt } });
  return decorateOrder(updated._id);
}

export async function markCustomerHandedToShipper(orderId, body, adminId) {
  const handedAt = new Date(body.customerHandedOverAt || Date.now());
  if (Number.isNaN(handedAt.getTime()) || handedAt > new Date(Date.now() + 5 * 60000)) throw new ApiError(400, "Thời điểm khách giao đồ không hợp lệ.");
  const updated = await RentalOrder.findOneAndUpdate(
    { _id: orderId, status: { $in: ["renting", "overdue"] }, returnMethod: "home_collection", "fulfillment.returnTrip.customerHandedOverAt": null },
    { $set: { status: "return_in_transit", billableRentalEndAt: handedAt, actualCollectionAt: handedAt, "schedule.customerReturnShippedAt": handedAt, "fulfillment.returnTrip.customerHandedOverAt": handedAt, "fulfillment.returnTrip.startedAt": handedAt, "fulfillment.returnTrip.status": "picking_up", "fulfillment.returnTrip.confirmedBy": adminId, ...Object.fromEntries(Object.entries(fulfillmentPatch(body)).map(([key, value]) => [`fulfillment.returnTrip.${key}`, value])) } },
    { new: true }
  );
  if (!updated) {
    const existing = await RentalOrder.findById(orderId);
    if (existing?.fulfillment?.returnTrip?.customerHandedOverAt) return decorateOrder(existing._id);
    throw new ApiError(409, "Đơn không cho phép ghi nhận khách giao đồ cho shipper.");
  }
  return decorateOrder(updated._id);
}

export async function confirmReturnReceivedByShop(orderId, body, adminId) {
  const receivedAt = new Date(body.receivedByShopAt || Date.now());
  if (Number.isNaN(receivedAt.getTime()) || receivedAt > new Date(Date.now() + 5 * 60000)) throw new ApiError(400, "Thời điểm shop nhận lại đồ không hợp lệ.");
  const updated = await RentalOrder.findOneAndUpdate(
    { _id: orderId, status: "return_in_transit", "fulfillment.returnTrip.customerHandedOverAt": { $ne: null }, "fulfillment.returnTrip.receivedByShopAt": null },
    { $set: { status: "returned", returnedAt: receivedAt, actualReturnDate: receivedAt, actualReturnedToStoreAt: receivedAt, turnaroundUntil: new Date(receivedAt.getTime() + RENTAL_TURNAROUND_MINUTES * 60000), "schedule.shopReceivedBackAt": receivedAt, "fulfillment.returnTrip.receivedByShopAt": receivedAt, "fulfillment.returnTrip.receivedAt": receivedAt, "fulfillment.returnTrip.status": "received", "fulfillment.returnTrip.confirmedBy": adminId, ...Object.fromEntries(Object.entries(fulfillmentPatch(body)).map(([key, value]) => [`fulfillment.returnTrip.${key}`, value])) } },
    { new: true }
  );
  if (!updated) {
    const existing = await RentalOrder.findById(orderId);
    if (existing?.fulfillment?.returnTrip?.receivedByShopAt) return decorateOrder(existing._id);
    throw new ApiError(409, "Đơn không ở trạng thái đang được vận chuyển về shop.");
  }
  await Reservation.updateMany({ orderId, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "inspection", actualReturnedToStoreAt: receivedAt, billableRentalEndAt: updated.billableRentalEndAt } });
  return decorateOrder(updated._id);
}

export async function collectCashAndPickup(orderId, adminId) {
  const resultId = await runFinancialTransaction("thu tiền mặt và bàn giao đồ", async session => {
    const query = RentalOrder.findById(orderId); const order = session ? await query.session(session) : await query;
    if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
    if (order.status === "renting" && order.fullPaymentId && ["paid", "fully_paid"].includes(order.paymentStatus)) return order._id;
    if (!["ready_for_handover", "ready_to_pickup", "ready_for_pickup"].includes(order.status) || order.pickupMethod !== "store_pickup" || order.paymentPreference !== "cash") throw new ApiError(400, "Đơn chưa sẵn sàng, không nhận tại shop hoặc không chọn tiền mặt.");
    const expectedAmount = Math.max(0, Number(order.finalAmount || (Number(order.totalRentalPrice || 0) + Number(order.totalDepositAmount || 0))) - Number(order.creditAppliedAmount || 0));
    if (expectedAmount <= 0) throw new ApiError(400, "Số tiền cần thu không hợp lệ.");
    let payment = await Payment.findOne({ idempotencyKey: `cash-pickup:${order._id}` });
    if (!payment) [payment] = await Payment.create([{ orderId: order._id, customerId: order.customerId, paymentType: "full", channel: "direct", method: "cash", amount: expectedAmount, status: "success", active: false, paymentGroup: "rental", provider: "manual", idempotencyKey: `cash-pickup:${order._id}`, paymentReference: `CASH-${order.orderCode}`, confirmedBy: adminId, confirmedAt: new Date(), paidAt: new Date() }], session ? { session } : {});
    const startedAt = new Date();
    order.fullPaymentId = payment._id; order.latestPaymentId = payment._id; order.paymentStatus = "fully_paid"; order.fullyPaidAt = payment.paidAt; order.status = "renting"; order.pickedUpAt = startedAt; order.rentalStartedAt = startedAt; order.actualRentalStartAt = startedAt; order.rentalDueAt = new Date(startedAt.getTime() + Number(order.rentalDurationHours || order.rentalDays * 24 || 24) * 3600000); await order.save(session ? { session } : {}); return order._id;
  });
  const decorated = await decorateOrder(resultId);
  emitOrderUpdated({ orderId: decorated._id, customerId: decorated.customerId?._id || decorated.customerId, status: decorated.status, paymentStatus: decorated.paymentStatus, reason: "cash_collected_pickup" });
  try {
    await createNotificationOnce({ recipientId: decorated.customerId?._id || decorated.customerId, recipientRole: "customer", title: "Đã thanh toán và nhận trang phục", message: "ARA đã ghi nhận thanh toán và bàn giao trang phục.", entityType: "rental_order", entityId: decorated._id, orderId: decorated._id, actionUrl: `/my-rentals/${decorated._id}`, type: "order_picked_up", priority: "normal", eventKey: `order:${decorated._id}:cash_collected_pickup:customer` });
  } catch (error) { console.error("[rental-order] Không thể gửi thông báo bàn giao:", { orderId: String(resultId), message: error?.message }); }
  return decorated;
}

export async function inspectReturn(orderId, payload, checkedBy) {
  const inspectionId = await runFinancialTransaction("quyết toán trả đồ", async (session) => {
    const query = RentalOrder.findById(orderId);
    const order = session ? await query.session(session) : await query;
    if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
    if (!["returned", "overdue"].includes(order.status)) {
      throw new ApiError(400, "Chỉ kiểm tra khi đơn đã trả đồ hoặc quá hạn.");
    }

    const actualReturnDate = order.billableRentalEndAt || order.actualReturnDate || order.returnedAt || new Date();
    const dueAt = new Date(order.rentalDueAt || order.schedule?.dueReturnAt || order.returnDate);
    const lateHours = actualReturnDate > dueAt ? Math.ceil((actualReturnDate - dueAt) / 3600000) : 0;
    const lateDays = lateHours > 0 ? Math.ceil(lateHours / 24) : 0;
    const lateFee = Number(order.extraDayCharge?.finalAmount || 0);
    const missingBoxes = Math.max(0, Math.trunc(Number(payload.missingBoxes) || 0));
    const missingBoxFee = calculateMissingBoxFee(missingBoxes);
    const cleaningFee = Math.max(0, Number(payload.cleaningFee) || 0);
    const shopSupportAmount = Math.max(0, Number(payload.shopSupportAmount) || 0);
    const cleaningSeverity = payload.cleaningSeverity || "none";
    if (cleaningSeverity === "light" && (cleaningFee !== 0 || shopSupportAmount !== 0)) throw new ApiError(400, "Đồ dơ nhẹ được shop xử lý miễn phí.");
    if (cleaningSeverity === "heavy" && (cleaningFee < RENTAL_POLICY.heavyCleaningFeeMin || cleaningFee > RENTAL_POLICY.heavyCleaningFeeMax)) throw new ApiError(400, "Phí giặt hấp phải từ 100.000 đến 250.000 đồng.");
    if (shopSupportAmount > cleaningFee) throw new ApiError(400, "Khoản shop hỗ trợ không được vượt phí giặt.");
    const customerCleaningFee = cleaningFee - shopSupportAmount;
    const repairFee = Math.max(0, Number(payload.repairFee) || 0);
    const liquidationPrice = Math.max(0, Number(payload.liquidationPrice) || 0);
    if (repairFee > 0 && liquidationPrice > 0) throw new ApiError(400, "Chỉ nhập phí sửa chữa hoặc giá thanh lý.");
    const damageFee = repairFee + liquidationPrice + missingBoxFee + customerCleaningFee;
    order.inspectedAt ||= new Date();
    order.lateFee = Math.max(Number(order.lateFee || 0), lateFee);
    order.damageFee = Number(order.damageFee || 0) + damageFee;
    order.totalPenalty = order.lateFee + order.damageFee;

    const successfulPayments = await getSuccessfulPayments(order._id, session);
    const settlement = calculateSettlement(order, successfulPayments);
    order.depositDeduction = settlement.depositDeduction;
    order.refundAmount = settlement.refundAmount;
    order.outstandingPenalty = settlement.outstandingPenalty;
    order.settlementStatus = settlement.settlementStatus;
    order.finalAmount = Number(order.totalRentalPrice || 0)
      + Number(order.totalDepositAmount || 0)
      + order.totalPenalty;

    const [inspection] = await ReturnInspection.create([{
      orderId,
      costumeId: payload.costumeId,
      condition: payload.condition,
      isDry: payload.isDry !== false,
      missingAccessories: payload.missingAccessories || "",
      missingBags: Math.max(0, Math.trunc(Number(payload.missingBags) || 0)),
      missingBoxes,
      missingBoxFee,
      returnedOnTime: lateHours <= 0,
      evidenceUrls: Array.isArray(payload.evidenceUrls) ? payload.evidenceUrls : [],
      cleaning: { severity: cleaningSeverity, cleaningFee, shopSupportAmount, customerCleaningFee, depositHeld: cleaningSeverity === "heavy" },
      damage: { severity: payload.damageSeverity || "none", description: payload.damageDescription || "", repairFee, liquidationPrice, confirmedBy: checkedBy },
      lateDays,
      lateHours,
      lateFee,
      damageFee,
      totalPenalty: order.totalPenalty,
      depositDeduction: order.depositDeduction,
      refundAmount: order.refundAmount,
      outstandingPenalty: order.outstandingPenalty,
      settlementStatus: order.settlementStatus,
      note: payload.note || "",
      checkedBy
    }], session ? { session } : {});

    await order.save(session ? { session } : {});
    if (order.outstandingPenalty > 0 || order.refundAmount > 0) {
      const needsPenalty = order.outstandingPenalty > 0;
      await createNotificationOnce(
        {
          recipientId: order.customerId,
          recipientRole: "customer",
          title: needsPenalty ? "Đơn thuê có phí phát sinh" : "Đơn đang chờ hoàn tiền cọc",
          message: needsPenalty
            ? `Phí trả trễ ${order.lateFee.toLocaleString("vi-VN")} đ, phí hư hỏng ${order.damageFee.toLocaleString("vi-VN")} đ. Còn cần thanh toán ${order.outstandingPenalty.toLocaleString("vi-VN")} đ sau khấu trừ cọc.`
            : `Cửa hàng cần hoàn lại ${order.refundAmount.toLocaleString("vi-VN")} đ tiền cọc.`,
          entityType: "return_inspection",
          entityId: inspection._id,
          orderId: order._id,
          inspectionId: inspection._id,
          actionUrl: `/my-rentals/${order._id}`,
          type: needsPenalty ? "penalty_payment_required" : "order_inspected",
          priority: needsPenalty ? "high" : "normal",
          eventKey: `inspection:${inspection._id}:${needsPenalty ? "penalty_required" : "refund_pending"}`,
          metadata: { lateFee: order.lateFee, damageFee: order.damageFee, amount: needsPenalty ? order.outstandingPenalty : order.refundAmount }
        },
        { session }
      );
    }
    return inspection._id;
  });

  const inspection = await ReturnInspection.findById(inspectionId);
  if (inspection?.refundAmount > 0 && !inspection.cleaning?.depositHeld) {
    const order = await RentalOrder.findById(orderId);
    await ensureRefund(order, inspection, checkedBy);
  }
  await Reservation.updateMany(
    { orderId, status: { $nin: ["completed", "cancelled", "expired"] } },
    { $set: { status: inspection?.condition === "damaged" ? "maintenance" : "cleaning" } }
  );
  if (inspection && Number(inspection.refundAmount || 0) === 0 && Number(inspection.outstandingPenalty || 0) === 0) {
    const order = await RentalOrder.findById(orderId);
    const [payments, refunds] = await Promise.all([Payment.find({ orderId }).lean(), DepositRefund.find({ orderId }).lean()]);
    const financial = getOrderFinancialSnapshot(order, payments, refunds);
    if (canCompleteOrder({ order, financial }).allowed) await completeOrder(orderId);
  }
  return ReturnInspection.findById(inspectionId)
    .populate("costumeId")
    .populate("checkedBy", "-password");
}

export function listInspection(orderId) {
  return ReturnInspection.find({ orderId }).populate("costumeId").populate("checkedBy", "-password");
}

export async function completeOrder(orderId) {
  const completedId = await runFinancialTransaction("hoàn tất đơn thuê", async (session) => {
    const orderQuery = RentalOrder.findById(orderId);
    const order = session ? await orderQuery.session(session) : await orderQuery;
    if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
    const paymentQuery = Payment.find({ orderId: order._id });
    const refundQuery = DepositRefund.find({ orderId: order._id });
    if (session) { paymentQuery.session(session); refundQuery.session(session); }
    const [allPayments, refunds] = await Promise.all([paymentQuery.lean(), refundQuery.lean()]);
    const financial = getOrderFinancialSnapshot(order, allPayments, refunds);
    const completionDecision = canCompleteOrder({ order, financial });
    if (!completionDecision.allowed) { const error = new ApiError(409, completionDecision.message); error.code = completionDecision.code; error.data = completionDecision.details; throw error; }
    if (order.status !== "returned") throw new ApiError(400, "Chỉ hoàn tất đơn đã trả đồ.");
    if (!order.inspectedAt) throw new ApiError(400, "Đơn chưa được kiểm tra sau khi trả.");
    if (Number(order.outstandingPenalty || 0) > 0) throw new ApiError(409, "Đơn còn phí phạt chưa thanh toán.");
    if (Number(order.refundAmount || 0) > 0) throw new ApiError(409, "Đơn còn tiền cọc chưa hoàn.");
    if (order.settlementStatus !== "settled") throw new ApiError(409, "Đơn chưa hoàn tất quyết toán.");
    const successfulPayments = await getSuccessfulPayments(order._id, session);
    const paid = summarizeSuccessfulPayments(order, successfulPayments);
    if (paid.rentalPaidAmount < Number(order.totalRentalPrice || 0)) {
      throw new ApiError(409, "Đơn còn tiền thuê chưa thanh toán.");
    }
    const activePayments = await getActivePayments(order._id, session);
    if (activePayments.length) throw new ApiError(409, "Đơn còn giao dịch đang xử lý.");

    order.status = "completed";
    order.completedAt = new Date();
    await order.save(session ? { session } : {});
    await Promise.all([
      Reservation.updateMany({ orderId: order._id }, { $set: { status: "completed" } }, session ? { session } : {}),
      TransportReservation.updateMany({ orderId: order._id, status: { $nin: ["failed", "cancelled", "expired"] } }, { $set: { status: "completed" } }, session ? { session } : {})
    ]);
    // Costume.status is an operational/admin state. Completing one order must
    // not overwrite maintenance, washing, hidden, or other intentional states.
    // Availability is derived from RentalOrderItem overlaps and quantity.
    await createNotificationOnce({
      recipientId: order.customerId,
      recipientRole: "customer",
      ...orderNotification("completed", order),
      eventKey: `order:${order._id}:completed:customer`
    }, { session });
    return order._id;
  });
  return decorateOrder(completedId);
}
