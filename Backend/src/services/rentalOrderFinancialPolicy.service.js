import { ACTIVE_PAYMENT_STATUSES, SUCCESS_PAYMENT_STATUSES, deriveOrderPaymentStatus, summarizeSuccessfulPayments } from "./paymentQuote.service.js";

const money = (value) => Math.max(0, Number(value || 0));

export const FINANCIAL_POLICY_CODES = Object.freeze({
  PRE_HANDOVER_PAYMENT_REQUIRED: "RENTAL_PRE_HANDOVER_PAYMENT_REQUIRED",
  ACTIVE_PAYMENT_EXISTS: "RENTAL_ACTIVE_PAYMENT_EXISTS",
  CASH_HOME_DELIVERY_FORBIDDEN: "RENTAL_CASH_HOME_DELIVERY_FORBIDDEN",
  REFUND_PENDING: "RENTAL_REFUND_PENDING",
  PENALTY_OUTSTANDING: "RENTAL_PENALTY_OUTSTANDING",
  INSPECTION_REQUIRED: "RENTAL_INSPECTION_REQUIRED",
  PHYSICAL_RETURN_REQUIRED: "RENTAL_PHYSICAL_RETURN_REQUIRED"
});

export function getOrderFinancialSnapshot(order, payments = [], refunds = []) {
  const successful = payments.filter((payment) => SUCCESS_PAYMENT_STATUSES.includes(payment?.status));
  const paid = summarizeSuccessfulPayments(order, successful);
  const depositRefunds = refunds.filter((refund) => !refund?.source || refund.source === "settlement");
  const completedRefundAmount = depositRefunds
    .filter((refund) => refund?.status === "completed")
    .reduce((sum, refund) => sum + money(refund.amount), 0);
  // DepositRefund is the canonical refund ledger. Legacy refund Payment rows
  // are only a fallback for orders that have never been reconciled into it.
  const depositAmountRefunded = depositRefunds.length ? completedRefundAmount : paid.refundedAmount;
  const rentalAmountRequired = money(order.totalRentalPrice);
  const depositAmountRequired = money(order.totalDepositAmount);
  const additionalFeeRequired = money(order.totalPenalty || money(order.lateFee) + money(order.damageFee));
  const additionalFeeCollected = paid.penaltyPaidAmount;
  const depositAmountCollected = paid.depositPaidAmount;
  const rentalAmountCollected = paid.rentalPaidAmount;
  const depositAmountDeducted = Math.min(depositAmountCollected, additionalFeeRequired);
  const outstandingBeforeHandover = Math.max(0,
    rentalAmountRequired + depositAmountRequired - rentalAmountCollected - depositAmountCollected
  );
  const outstandingAfterReturn = Math.max(0,
    additionalFeeRequired - additionalFeeCollected - depositAmountDeducted
  );
  const refundableDepositAmount = Math.max(0,
    depositAmountCollected - depositAmountDeducted - depositAmountRefunded
  );
  const hasRelevantPendingPayment = payments.some((payment) => payment?.active !== false && ACTIVE_PAYMENT_STATUSES.includes(payment?.status));
  const hasRelevantPendingRefund = depositRefunds.some((refund) => ["awaiting_information", "pending", "processing"].includes(refund?.status));
  const activePayments = payments.filter((payment) => payment?.active !== false && ACTIVE_PAYMENT_STATUSES.includes(payment?.status));
  const effectivePaymentStatus = deriveOrderPaymentStatus(order, successful, activePayments);
  const needsFinancialReview = Boolean(order.needsFinancialReview)
    || rentalAmountCollected > rentalAmountRequired
    || depositAmountCollected > depositAmountRequired
    || depositAmountRefunded > depositAmountCollected;
  const afterReturn = ["returned", "completed"].includes(order.status) || Boolean(order.inspectedAt);

  return {
    rentalAmountRequired,
    rentalAmountCollected,
    depositAmountRequired,
    depositAmountCollected,
    additionalFeeRequired,
    additionalFeeCollected,
    depositAmountRefunded,
    depositAmountDeducted,
    outstandingBeforeHandover,
    outstandingAfterReturn,
    refundableDepositAmount,
    hasRelevantPendingPayment,
    hasRelevantPendingRefund,
    isDepositSatisfied: depositAmountCollected >= depositAmountRequired,
    isRentalFullyPaid: rentalAmountCollected >= rentalAmountRequired,
    isPreHandoverFullyPaid: outstandingBeforeHandover === 0,
    isSettlementResolved: outstandingAfterReturn === 0 && refundableDepositAmount === 0 && !hasRelevantPendingRefund,
    rentalRequired: rentalAmountRequired,
    depositRequired: depositAmountRequired,
    additionalFeeRequired,
    rentalCollected: rentalAmountCollected,
    depositCollected: depositAmountCollected,
    additionalFeeCollected,
    refundedAmount: depositAmountRefunded,
    refundableDeposit: refundableDepositAmount,
    outstandingAmount: afterReturn ? outstandingAfterReturn : outstandingBeforeHandover,
    effectivePaymentStatus,
    needsFinancialReview
  };
}

const block = (code, message, details = {}) => ({ allowed: false, code, message, details });
const allow = () => ({ allowed: true, code: null, message: "", details: {} });

export function canDispatchHomeDelivery({ order, financial }) {
  if (order.paymentPreference === "cash") return block(FINANCIAL_POLICY_CODES.CASH_HOME_DELIVERY_FORBIDDEN, "Không hỗ trợ thanh toán tiền thuê bằng tiền mặt khi giao tận nơi.");
  if (financial.hasRelevantPendingPayment) return block(FINANCIAL_POLICY_CODES.ACTIVE_PAYMENT_EXISTS, "Đơn còn giao dịch đang xử lý.");
  if (!financial.isPreHandoverFullyPaid) return block(FINANCIAL_POLICY_CODES.PRE_HANDOVER_PAYMENT_REQUIRED, "Đơn chưa thanh toán đủ tiền thuê và tiền cọc trước khi giao đồ.", { required: financial.rentalAmountRequired + financial.depositAmountRequired, collected: financial.rentalAmountCollected + financial.depositAmountCollected, outstanding: financial.outstandingBeforeHandover });
  return allow();
}

export function canStartRental({ order, financial }) {
  if (order.pickupMethod === "home_delivery") return canDispatchHomeDelivery({ order, financial });
  if (order.paymentPreference === "cash") return allow();
  if (!financial.isPreHandoverFullyPaid) return block(FINANCIAL_POLICY_CODES.PRE_HANDOVER_PAYMENT_REQUIRED, "Đơn chưa thanh toán đủ khoản bắt buộc trước khi bàn giao.", { outstanding: financial.outstandingBeforeHandover });
  return allow();
}

export function canCompleteOrder({ order, financial }) {
  if (order.status !== "returned" || !order.returnedAt) return block(FINANCIAL_POLICY_CODES.PHYSICAL_RETURN_REQUIRED, "Shop chưa ghi nhận đã nhận lại đồ.");
  if (!order.inspectedAt) return block(FINANCIAL_POLICY_CODES.INSPECTION_REQUIRED, "Đơn chưa được kiểm tra sau khi trả.");
  if (financial.outstandingAfterReturn > 0) return block(FINANCIAL_POLICY_CODES.PENALTY_OUTSTANDING, "Đơn còn phí phát sinh chưa thanh toán.", { outstanding: financial.outstandingAfterReturn });
  if (financial.refundableDepositAmount > 0 || financial.hasRelevantPendingRefund) return block(FINANCIAL_POLICY_CODES.REFUND_PENDING, "Đơn còn tiền cọc cần hoàn hoặc giao dịch hoàn đang xử lý.", { refundable: financial.refundableDepositAmount });
  return allow();
}

export function getAllowedRentalOrderActions({ order, financial }) {
  const dispatch = canDispatchHomeDelivery({ order, financial });
  const start = canStartRental({ order, financial });
  const complete = canCompleteOrder({ order, financial });
  const isReady = ["ready_for_handover", "ready_to_pickup", "ready_for_pickup"].includes(order.status);
  const actions = {
    confirmOrder: order.status === "pending_payment" && (financial.isDepositSatisfied || financial.isPreHandoverFullyPaid || (order.pickupMethod === "store_pickup" && order.paymentPreference === "cash")),
    startPreparing: order.status === "confirmed",
    markReadyForHandover: ["confirmed", "preparing", "deposit_paid"].includes(order.status),
    collectCashAndPickup: isReady && order.pickupMethod === "store_pickup" && order.paymentPreference === "cash",
    confirmStorePickup: isReady && order.pickupMethod === "store_pickup" && order.paymentPreference !== "cash" && start.allowed,
    dispatchHomeDelivery: isReady && order.pickupMethod === "home_delivery" && dispatch.allowed,
    confirmCustomerReceived: order.status === "outbound_in_transit",
    markCustomerHandedToShipper: ["renting", "overdue"].includes(order.status) && order.returnMethod === "home_collection",
    confirmReturnReceivedByShop: order.status === "return_in_transit",
    inspectReturn: order.status === "returned",
    collectOutstanding: order.status === "returned" && financial.outstandingAfterReturn > 0,
    refundDeposit: order.status === "returned" && financial.refundableDepositAmount > 0 && !financial.hasRelevantPendingRefund,
    completeOrder: complete.allowed,
    changePaymentMethod: ["pending_payment", "confirmed"].includes(order.status) && !financial.hasRelevantPendingPayment
  };
  Object.assign(actions, {
    canPay: ["pending_payment", "confirmed", "preparing", "ready_for_handover", "ready_to_pickup", "renting", "returned"].includes(order.status) && financial.outstandingAmount > 0 && !financial.hasRelevantPendingPayment,
    canChangePaymentMethod: actions.changePaymentMethod,
    canPrepare: actions.startPreparing,
    canDispatch: actions.dispatchHomeDelivery,
    canHandover: actions.collectCashAndPickup || actions.confirmStorePickup,
    canConfirmDelivery: actions.confirmCustomerReceived,
    canStartReturnCollection: actions.markCustomerHandedToShipper,
    canConfirmReturned: actions.confirmReturnReceivedByShop,
    canInspect: actions.inspectReturn,
    canSettle: actions.collectOutstanding || actions.refundDeposit,
    canProcessRefund: actions.refundDeposit,
    canComplete: actions.completeOrder,
    canCancel: ["pending_payment", "confirmed"].includes(order.status) && !financial.hasRelevantPendingPayment && !order.cancellationRequestedAt
  });
  return {
    allowedActions: actions,
    actionBlockReasons: {
      dispatchHomeDelivery: dispatch.allowed ? [] : [dispatch],
      confirmStorePickup: start.allowed ? [] : [start],
      completeOrder: complete.allowed ? [] : [complete]
    }
  };
}
