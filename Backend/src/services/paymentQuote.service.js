import { Payment } from "../models/Payment.js";

export const PAYMENT_TYPES = [
  "deposit",
  "full",
  "rental_balance",
  "penalty",
  "refund"
];

export const ACTIVE_PAYMENT_STATUSES = ["pending", "awaiting_confirmation"];
export const SUCCESS_PAYMENT_STATUSES = ["success"];

const money = (value) => Math.max(0, Number(value || 0));

export function summarizeSuccessfulPayments(order, payments = []) {
  const depositTarget = money(order.totalDepositAmount);
  let depositPaidAmount = 0;
  let rentalPaidAmount = 0;
  let penaltyPaidAmount = 0;
  let refundedAmount = 0;

  for (const payment of payments) {
    if (!SUCCESS_PAYMENT_STATUSES.includes(payment.status)) continue;
    const amount = money(payment.amount);

    if (payment.paymentType === "deposit") {
      depositPaidAmount += amount;
    } else if (payment.paymentType === "full") {
      const depositPart = Math.min(depositTarget, amount);
      depositPaidAmount += depositPart;
      rentalPaidAmount += Math.max(0, amount - depositPart);
    } else if (payment.paymentType === "rental_balance") {
      rentalPaidAmount += amount;
    } else if (payment.paymentType === "penalty") {
      penaltyPaidAmount += amount;
    } else if (payment.paymentType === "refund") {
      refundedAmount += amount;
    }
  }

  return {
    depositPaidAmount: Math.min(depositTarget, depositPaidAmount),
    rentalPaidAmount: Math.min(money(order.totalRentalPrice), rentalPaidAmount),
    penaltyPaidAmount,
    refundedAmount,
    totalSuccessfulAmount: payments
      .filter((payment) => SUCCESS_PAYMENT_STATUSES.includes(payment.status))
      .reduce((total, payment) => total + money(payment.amount), 0)
  };
}

export function calculateSettlement(order, payments = []) {
  const paid = summarizeSuccessfulPayments(order, payments);
  const totalPenalty = money(order.totalPenalty || money(order.lateFee) + money(order.damageFee));
  const depositDeduction = Math.min(paid.depositPaidAmount, totalPenalty);
  const refundAmount = Math.max(0, paid.depositPaidAmount - totalPenalty - paid.refundedAmount);
  const outstandingPenalty = Math.max(0, totalPenalty - paid.depositPaidAmount - paid.penaltyPaidAmount);
  const settlementStatus = outstandingPenalty > 0
    ? "pending_penalty"
    : refundAmount > 0
    ? "pending_refund"
    : "settled";

  return {
    ...paid,
    totalPenalty,
    depositDeduction,
    refundAmount,
    outstandingPenalty,
    settlementStatus
  };
}

export function calculatePaymentQuoteFromData(order, paymentType, payments = [], { isAdmin = false } = {}) {
  const paid = summarizeSuccessfulPayments(order, payments);
  const settlement = calculateSettlement(order, payments);
  const orderStatus = order.status;
  let originalAmount = 0;
  let paidAmount = 0;
  let payableAmount = 0;
  let canPay = false;
  let reason = "";

  if (paymentType === "deposit") {
    originalAmount = money(order.totalDepositAmount);
    paidAmount = paid.depositPaidAmount;
    payableAmount = Math.max(0, originalAmount - paidAmount);
    canPay = ["pending_payment", "confirmed"].includes(orderStatus) && paid.totalSuccessfulAmount === 0 && payableAmount > 0;
    reason = canPay ? "" : !["pending_payment", "confirmed"].includes(orderStatus)
      ? "Chỉ có thể đặt cọc sau khi đơn được xác nhận."
      : paid.totalSuccessfulAmount > 0
      ? "Đơn đã có khoản thanh toán thành công."
      : "Không còn tiền cọc cần thanh toán.";
  } else if (paymentType === "full") {
    originalAmount = money(order.totalRentalPrice) + money(order.totalDepositAmount);
    paidAmount = paid.depositPaidAmount + paid.rentalPaidAmount;
    payableAmount = Math.max(0, originalAmount - paidAmount);
    canPay = ["pending_payment", "confirmed"].includes(orderStatus) && paid.totalSuccessfulAmount === 0 && payableAmount > 0;
    reason = canPay ? "" : paid.totalSuccessfulAmount > 0
      ? "Đơn đã có thanh toán trước đó; hãy dùng thanh toán phần còn lại."
      : !["pending_payment", "confirmed"].includes(orderStatus)
      ? "Chỉ có thể thanh toán toàn bộ sau khi đơn được xác nhận."
      : "Đơn không còn số tiền cần thanh toán.";
  } else if (paymentType === "rental_balance") {
    originalAmount = money(order.totalRentalPrice);
    paidAmount = paid.rentalPaidAmount;
    payableAmount = Math.max(0, originalAmount - paidAmount);
    const allowedStatus = ["confirmed", "preparing", "deposit_paid", "ready_for_handover", "ready_to_pickup", "ready_for_pickup", "renting", "returned"].includes(orderStatus);
    canPay = allowedStatus && paid.depositPaidAmount > 0 && payableAmount > 0;
    reason = canPay ? "" : paid.depositPaidAmount <= 0
      ? "Đơn chưa có khoản đặt cọc thành công."
      : !allowedStatus
      ? "Trạng thái đơn không cho phép thanh toán phần còn lại."
      : "Tiền thuê đã được thanh toán đủ.";
  } else if (paymentType === "penalty") {
    originalAmount = settlement.totalPenalty;
    paidAmount = settlement.depositDeduction + paid.penaltyPaidAmount;
    payableAmount = settlement.outstandingPenalty;
    canPay = orderStatus === "returned"
      && order.settlementStatus === "pending_penalty"
      && payableAmount > 0;
    reason = canPay ? "" : payableAmount <= 0
      ? "Tiền cọc đã đủ khấu trừ toàn bộ phí phát sinh."
      : "Đơn chưa ở trạng thái chờ thanh toán phí phát sinh.";
  } else if (paymentType === "refund") {
    originalAmount = settlement.refundAmount + paid.refundedAmount;
    paidAmount = paid.refundedAmount;
    payableAmount = settlement.refundAmount;
    canPay = isAdmin
      && orderStatus === "returned"
      && order.settlementStatus === "pending_refund"
      && payableAmount > 0;
    reason = canPay ? "" : !isAdmin
      ? "Chỉ cửa hàng được tạo giao dịch hoàn cọc."
      : payableAmount <= 0
      ? "Không còn tiền cọc cần hoàn."
      : "Đơn chưa ở trạng thái chờ hoàn cọc.";
  } else {
    reason = "Loại thanh toán không hợp lệ.";
  }

  return {
    orderId: String(order._id || order.id),
    paymentType,
    originalAmount,
    paidAmount,
    payableAmount,
    currency: "VND",
    canPay,
    reason,
    depositPaidAmount: paid.depositPaidAmount,
    rentalPaidAmount: paid.rentalPaidAmount,
    totalPenalty: settlement.totalPenalty,
    depositDeduction: settlement.depositDeduction,
    refundAmount: settlement.refundAmount,
    outstandingPenalty: settlement.outstandingPenalty,
    settlementStatus: settlement.settlementStatus
  };
}

export async function getSuccessfulPayments(orderId, session = null) {
  const query = Payment.find({
    orderId,
    status: { $in: SUCCESS_PAYMENT_STATUSES }
  }).sort({ createdAt: 1 });
  if (session) query.session(session);
  return query;
}

export async function getActivePayments(orderId, session = null) {
  const query = Payment.find({
    orderId,
    active: true,
    status: { $in: ACTIVE_PAYMENT_STATUSES }
  }).sort({ createdAt: -1 });
  if (session) query.session(session);
  return query;
}

export async function calculatePaymentQuote(order, paymentType, options = {}) {
  const payments = await getSuccessfulPayments(order._id, options.session || null);
  return calculatePaymentQuoteFromData(order, paymentType, payments, options);
}

export function deriveOrderPaymentStatus(order, successfulPayments = [], activePayments = []) {
  if (activePayments.some((payment) => payment.status === "awaiting_confirmation")) return "awaiting_confirmation";
  if (activePayments.some((payment) => payment.status === "pending")) return "awaiting_payment";

  if (["pending_penalty", "pending_refund"].includes(order.settlementStatus)) return "settlement_pending";
  if (order.settlementStatus === "settled" && order.status === "returned") return "settled";

  const paid = summarizeSuccessfulPayments(order, successfulPayments);
  const depositCovered = paid.depositPaidAmount >= money(order.totalDepositAmount) && money(order.totalDepositAmount) > 0;
  const rentalCovered = paid.rentalPaidAmount >= money(order.totalRentalPrice);
  if (depositCovered && rentalCovered) return "fully_paid";
  if (depositCovered) return "deposit_paid";
  return "unpaid";
}
