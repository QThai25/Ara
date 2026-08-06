export const NOTIFICATION_CATEGORIES = [
  "rental_order", "payment", "costume_service", "promotion", "account_system", "consultation", "inventory", "customer"
];

const TYPE_TAXONOMY = {
  order_created: ["rental_order", "order_pending"],
  order_approved: ["rental_order", "order_confirmed"],
  order_rejected: ["rental_order", "order_rejected_canceled"],
  order_canceled: ["rental_order", "order_rejected_canceled"],
  rental_order_expired: ["rental_order", "order_rejected_canceled"],
  late_payment_order_restored: ["rental_order", "order_confirmed"],
  late_payment_schedule_conflict: ["payment", "refund"],
  late_payment_refund_created: ["payment", "refund"],
  order_ready_for_pickup: ["rental_order", "ready_for_pickup"],
  order_picked_up: ["rental_order", "renting"],
  order_due_soon: ["rental_order", "return_reminder"],
  order_overdue: ["rental_order", "overdue"],
  order_returned: ["rental_order", "returned"],
  order_completed: ["rental_order", "completed"],
  order_inspection_required: ["inventory", "inspection_required"],
  order_inspected: ["costume_service", "return_inspection"],
  deposit_payment_requested: ["payment", "deposit_pending"],
  deposit_payment_confirmed: ["payment", "deposit_success"],
  full_payment_requested: ["payment", "full_payment_pending"],
  full_payment_confirmed: ["payment", "full_payment_success"],
  rental_balance_payment_confirmed: ["payment", "rental_balance_success"],
  penalty_payment_required: ["payment", "penalty_required"],
  penalty_payment_requested: ["payment", "penalty_pending"],
  penalty_payment_confirmed: ["payment", "penalty_success"],
  payment_awaiting_confirmation: ["payment", "payment_waiting_confirmation"],
  payment_success: ["payment", "payment_success"],
  payment_rejected: ["payment", "payment_failed_rejected"],
  payment_failed: ["payment", "payment_failed_rejected"],
  payment_canceled: ["payment", "payment_failed_rejected"],
  payment_expired: ["payment", "payment_expired"],
  payment_refunded: ["payment", "refund"],
  payment_deposit_completed: ["payment", "deposit_success"],
  payment_full_completed: ["payment", "full_payment_success"],
  payment_rental_balance_completed: ["payment", "rental_balance_success"],
  payment_penalty_completed: ["payment", "penalty_success"],
  payment_refund_completed: ["payment", "refund"],
  refund_information_required: ["payment", "refund"],
  settlement_penalty_required: ["payment", "penalty_required"],
  settlement_refund_pending: ["payment", "refund"],
  settlement_completed: ["payment", "settlement_completed"],
  costume_available: ["costume_service", "costume_available"],
  costume_unavailable: ["costume_service", "costume_unavailable"],
  costume_preparing: ["costume_service", "costume_preparing"],
  costume_washing: ["costume_service", "costume_washing"],
  costume_damaged: ["costume_service", "costume_damaged"],
  promotion: ["promotion", "promotion"],
  voucher_new: ["promotion", "voucher_new"],
  voucher_expiring: ["promotion", "voucher_expiring"],
  customer_support: ["costume_service", "support_request"],
  chat_message: ["consultation", "chat_message"],
  system: ["account_system", "system"]
};

export const NOTIFICATION_SUBTYPES = [...new Set(Object.values(TYPE_TAXONOMY).map(([, subtype]) => subtype))];
const SUBTYPE_GROUPS = {
  deposit: ["deposit_pending", "deposit_success"],
  full_payment: ["full_payment_pending", "full_payment_success", "rental_balance_success"],
  penalty: ["penalty_required", "penalty_pending", "penalty_success"],
  payment_pending: ["deposit_pending", "full_payment_pending", "penalty_pending", "payment_waiting_confirmation"],
  payment_success_group: ["deposit_success", "full_payment_success", "rental_balance_success", "penalty_success", "payment_success", "settlement_completed"],
  payment_failed_group: ["payment_failed_rejected", "payment_expired"],
  rejected_canceled: ["order_rejected_canceled"],
  unavailable: ["costume_unavailable"],
  washing: ["costume_washing"],
  damaged: ["costume_damaged"],
  inspection: ["inspection_required", "return_inspection"]
};
export const NOTIFICATION_FILTER_SUBTYPES = [...new Set([...NOTIFICATION_SUBTYPES, ...Object.keys(SUBTYPE_GROUPS)])];

const ACTION_TYPES = new Set([
  "order_created", "order_overdue", "order_inspection_required", "deposit_payment_requested",
  "full_payment_requested", "penalty_payment_requested", "payment_awaiting_confirmation",
  "penalty_payment_required", "settlement_penalty_required", "settlement_refund_pending", "customer_support"
]);
export const NOTIFICATION_ACTION_TYPES = [...ACTION_TYPES];

export function notificationTaxonomy(type = "system", recipientRole = "customer") {
  const adminRecipient = ["admin", "staff", "owner"].includes(recipientRole);
  const adminOverrides = {
    order_overdue: ["inventory", "overdue"], costume_washing: ["inventory", "costume_washing"],
    costume_damaged: ["inventory", "costume_damaged"], customer_support: ["customer", "support_request"]
  };
  const adminOverride = adminRecipient ? adminOverrides[type] : null;
  const [category, subtype] = adminOverride || TYPE_TAXONOMY[type] || ["account_system", type || "system"];
  return { category, subtype, requiresAction: adminRecipient && ACTION_TYPES.has(type) };
}

export function typesForTaxonomy(category, subtype) {
  const acceptedSubtypes = subtype ? (SUBTYPE_GROUPS[subtype] || [subtype]) : null;
  const types = Object.entries(TYPE_TAXONOMY)
    .filter(([, value]) => (!category || value[0] === category) && (!acceptedSubtypes || acceptedSubtypes.includes(value[1])))
    .map(([type]) => type);
  if (category === "inventory" && (!subtype || subtype === "overdue")) types.push("order_overdue");
  if (category === "inventory" && (!subtype || ["washing", "costume_washing"].includes(subtype))) types.push("costume_washing");
  if (category === "inventory" && (!subtype || ["damaged", "costume_damaged"].includes(subtype))) types.push("costume_damaged");
  if (category === "customer" && (!subtype || subtype === "support_request")) types.push("customer_support");
  return [...new Set(types)];
}
