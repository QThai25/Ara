import mongoose from "mongoose";

const rentalOrderSchema = new mongoose.Schema(
  {
    // Optional only for legacy documents until the backfill has run. Every new
    // order is still required by the creation service to receive a unique code.
    orderCode: { type: String, unique: true, sparse: true, index: true, trim: true, uppercase: true },
    paymentPreference: { type: String, enum: ["cash", "bank_transfer", "payos"], default: "bank_transfer" },
    paymentMethod: { type: String, enum: ["cash", "bank_transfer", "payos"], default: "bank_transfer", index: true },
    approvalMode: { type: String, enum: ["automatic", "manual"], default: "automatic" },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    customerInfo: {
      fullName: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
      phoneNormalized: { type: String, default: "", trim: true, index: true },
      email: { type: String, default: "", trim: true, lowercase: true },
      isGuest: { type: Boolean, default: false },
      phoneVerified: { type: Boolean, default: false }
    },

    // Defaults preserve old orders; every new checkout is enforced in the service.
    policyAccepted: { type: Boolean, default: false },
    policyVersion: { type: String, default: "LEGACY_UNRECORDED", trim: true },
    policyAcceptedAt: { type: Date, default: null },

    schedule: {
      pickupAt: { type: Date, default: null },
      mainWearDate: { type: Date, default: null },
      dueReturnAt: { type: Date, default: null },
      actualReturnAt: { type: Date, default: null },
      isOutOfProvince: { type: Boolean, default: false },
      shopShippedAt: { type: Date, default: null },
      customerReceivedAt: { type: Date, default: null },
      customerReturnShippedAt: { type: Date, default: null },
      shopReceivedBackAt: { type: Date, default: null }
    },

    deposit: {
      method: { type: String, enum: ["partial_cash", "full_rental", "original_id", null], default: null },
      amount: { type: Number, min: 0, default: 0 },
      status: { type: String, enum: ["pending", "received", "held", "released"], default: "pending" },
      note: { type: String, default: "", trim: true },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      confirmedAt: { type: Date, default: null },
      originalIdReceivedAt: { type: Date, default: null },
      originalIdReturnedAt: { type: Date, default: null }
    },

    shipping: {
      outboundFee: { type: Number, min: 0, default: 0 },
      returnFee: { type: Number, min: 0, default: 0 },
      totalFee: { type: Number, min: 0, default: 0 }
    },
    fulfillment: {
      method: { type: String, enum: ["store_pickup", "delivery_store_return", "two_way_delivery"], default: "store_pickup" },
      receiverSnapshot: { fullName: { type: String, default: "" }, phone: { type: String, default: "" } },
      deliveryAddressSnapshot: { addressLine: { type: String, default: "" }, wardCode: String, wardName: String, districtCode: String, districtName: String, provinceCode: String, provinceName: String, note: String },
      outbound: {
        scheduledFrom: Date, scheduledTo: Date, fee: { type: Number, min: 0, default: 0 },
        status: { type: String, enum: ["not_required","pending","scheduled","preparing","out_for_delivery","delivered","failed","canceled"], default: "not_required" },
        provider: String, trackingCode: String, driverName: String, driverPhone: String, startedAt: Date, deliveredAt: Date, failedAt: Date, failureReason: String,
        proofImages: [{ type: String }], note: String
      },
      returnTrip: {
        scheduledFrom: Date, scheduledTo: Date, fee: { type: Number, min: 0, default: 0 },
        status: { type: String, enum: ["not_required","pending","scheduled","awaiting_pickup","picking_up","received","failed","canceled"], default: "not_required" },
        provider: String, trackingCode: String, driverName: String, driverPhone: String, startedAt: Date, receivedAt: Date, failedAt: Date, failureReason: String,
        proofImages: [{ type: String }], note: String
      },
      totalFee: { type: Number, min: 0, default: 0 }
    },

    exchangeCount: { type: Number, min: 0, default: 0 },
    immediateReturnCharge: { type: Number, min: 0, default: 0 },
    extraDayCharge: {
      extraDays: { type: Number, min: 0, default: 0 },
      noticeGiven: { type: Boolean, default: true },
      impactsNextRental: { type: Boolean, default: false },
      suggestedAmount: { type: Number, min: 0, default: 0 },
      finalAmount: { type: Number, min: 0, default: 0 },
      reason: { type: String, default: "" },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      confirmedAt: { type: Date, default: null }
    },
    creditAppliedAmount: { type: Number, min: 0, default: 0 },
    settlement: {
      totalIncidentalFees: { type: Number, min: 0, default: 0 },
      heldDeposit: { type: Number, min: 0, default: 0 },
      deductedAmount: { type: Number, min: 0, default: 0 },
      customerPayable: { type: Number, min: 0, default: 0 },
      remainingDeposit: { type: Number, min: 0, default: 0 },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      confirmedAt: { type: Date, default: null }
    },

    invoice: {
      requested: { type: Boolean, default: false },
      email: { type: String, default: "", trim: true, lowercase: true },
      status: { type: String, enum: ["not_requested", "pending", "sent", "failed"], default: "not_requested" },
      sentAt: { type: Date, default: null },
      messageId: { type: String, default: "", trim: true },
      lastAttemptAt: { type: Date, default: null },
      lastError: { type: String, default: "", trim: true },
      attempts: { type: Number, default: 0, min: 0 }
    },

    rentalDate: {
      type: Date,
      required: true
    },
    rentalDays: { type: Number, min: 1, default: 1 },
    rentalDurationHours: { type: Number, min: 24, default: 24 },
    pickupMethod: { type: String, enum: ["store_pickup", "home_delivery"], default: "store_pickup", index: true },
    returnMethod: { type: String, enum: ["store_return", "home_collection"], default: "store_return", index: true },
    source: { type: String, enum: ["online", "walk_in", "admin", "migration"], default: "online", index: true },
    idempotencyKey: { type: String, default: null, sparse: true, unique: true, index: true },
    quoteId: { type: String, default: "", trim: true },
    quoteVersion: { type: Number, min: 1, default: 1 },
    plannedRentalStartAt: { type: Date, default: null, index: true },
    plannedRentalEndAt: { type: Date, default: null, index: true },
    deliveryDispatchAt: { type: Date, default: null },
    expectedDeliveryAt: { type: Date, default: null },
    collectionAt: { type: Date, default: null },
    expectedReturnedToStoreAt: { type: Date, default: null },
    actualRentalStartAt: { type: Date, default: null },
    actualDeliveryAt: { type: Date, default: null },
    actualCollectionAt: { type: Date, default: null },
    actualReturnedToStoreAt: { type: Date, default: null },
    billableRentalEndAt: { type: Date, default: null },
    blockedStartAt: { type: Date, default: null, index: true },
    blockedEndAt: { type: Date, default: null, index: true },
    preparationMinutes: { type: Number, min: 0, default: 30 },
    inspectionMinutes: { type: Number, min: 0, default: 30 },
    cleaningMinutes: { type: Number, min: 0, default: 180 },
    outboundTransportMinutes: { type: Number, min: 0, default: 0 },
    inboundTransportMinutes: { type: Number, min: 0, default: 0 },
    transportZoneId: { type: mongoose.Schema.Types.ObjectId, ref: "ShippingZone", default: null },
    transportQuoteVersion: { type: Number, min: 1, default: 1 },
    transportQuoteSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    deliveryFee: { type: Number, min: 0, default: 0 },
    collectionFee: { type: Number, min: 0, default: 0 },
    migrationStatus: { type: String, enum: ["not_required", "migrated", "requires_review"], default: "not_required", index: true },
    legacySnapshot: { type: mongoose.Schema.Types.Mixed, default: null },

    mainUseDate: { type: String, default: "", trim: true },
    extraDays: { type: Number, min: 0, default: 0 },
    standardPackageDays: { type: Number, default: 3 },
    standardPackageNights: { type: Number, default: 2 },
    totalHoldDays: { type: Number, min: 0, default: 0 },
    totalHoldNights: { type: Number, min: 0, default: 0 },
    baseRentalAmount: { type: Number, min: 0, default: 0 },
    plannedExtraDayFee: { type: Number, min: 0, default: 0 },
    cleaningUntil: { type: Date, default: null, index: true },
    blockedFrom: { type: Date, default: null, index: true },
    blockedUntil: { type: Date, default: null, index: true },
    legacySchedule: { type: Boolean, default: false },

    returnDate: {
      type: Date,
      required: true
    },

    actualReturnDate: {
      type: Date,
      default: null
    },

    holdExpiresAt: {
      type: Date,
      default: null,
      index: true
    },
    paymentExpiresAt: { type: Date, default: null, index: true },
    bookingStatus: {
      type: String,
      enum: ["payment_pending", "confirmed", "preparing", "ready", "rented", "returned", "completed", "cancelled"],
      default: "payment_pending",
      index: true
    },

    expiredAt: {
      type: Date,
      default: null
    },

    turnaroundUntil: {
      type: Date,
      default: null,
      index: true
    },
    /*
     * Giữ toàn bộ status cũ để chưa ảnh hưởng
     * frontend và API hiện có.
     */
    status: {
      type: String,
      enum: [
        "pending",
        "pending_confirmation",
        "confirmed",
        "deposit_paid",
        "deposited",
        "paid",
        "ready_to_pickup",
        "ready_for_pickup",
        "renting",
        "returned",
        "completed",
        "canceled",
        "cancelled",
        "rejected",
        "expired",
        "overdue"
      ],
      default: "pending",
      index: true
    },

    totalRentalPrice: {
      type: Number,
      default: 0,
      min: 0
    },

    totalDepositAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    lateFee: {
      type: Number,
      default: 0,
      min: 0
    },

    damageFee: {
      type: Number,
      default: 0,
      min: 0
    },

    totalPenalty: { type: Number, default: 0, min: 0 },
    depositDeduction: { type: Number, default: 0, min: 0 },
    refundAmount: { type: Number, default: 0, min: 0 },
    outstandingPenalty: { type: Number, default: 0, min: 0 },

    settlementStatus: {
      type: String,
      enum: ["not_required", "pending_penalty", "pending_refund", "settled"],
      default: "not_required",
      index: true
    },

    finalAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    /*
     * Giữ trạng thái cũ và bổ sung trạng thái mới.
     *
     * pending:
     *   tương thích dữ liệu cũ.
     *
     * unpaid:
     *   chưa tạo giao dịch.
     *
     * awaiting_payment:
     *   đang chờ MoMo/ngân hàng.
     *
     * awaiting_confirmation:
     *   đang chờ admin xác nhận thanh toán trực tiếp.
     *
     * deposited:
     *   tương thích dữ liệu cũ.
     *
     * deposit_paid:
     *   trạng thái mới, đã thanh toán cọc.
     *
     * paid / fully_paid:
     *   đã thanh toán toàn bộ.
     */
    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "unpaid",
        "awaiting_payment",
        "awaiting_confirmation",
        "awaiting_verification",
        "partially_paid",
        "failed",
        "expired",
        "deposited",
        "deposit_paid",
        "paid",
        "fully_paid",
        "settlement_pending",
        "settled",
        "refunded"
      ],
      default: "unpaid",
      index: true
    },

    /*
     * Giao dịch gần nhất của đơn.
     */
    latestPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    /*
     * Giao dịch đã thanh toán cọc thành công.
     */
    depositPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    /*
     * Giao dịch thanh toán toàn bộ thành công.
     */
    fullPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    penaltyPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    refundPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    note: {
      type: String,
      default: "",
      trim: true
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    approvedAt: {
      type: Date,
      default: null
    },

    depositPaidAt: {
      type: Date,
      default: null
    },

    fullyPaidAt: {
      type: Date,
      default: null
    },

    penaltyPaidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    readyForPickupAt: {
      type: Date,
      default: null
    },

    pickedUpAt: {
      type: Date,
      default: null
    },

    returnedAt: {
      type: Date,
      default: null
    },

    inspectedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    rejectedAt: {
      type: Date,
      default: null
    },

    rejectReason: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

rentalOrderSchema.virtual("items", {
  ref: "RentalOrderItem",
  localField: "_id",
  foreignField: "orderId"
});

rentalOrderSchema.virtual("payments", {
  ref: "Payment",
  localField: "_id",
  foreignField: "orderId"
});

rentalOrderSchema.virtual("inspection", {
  ref: "ReturnInspection",
  localField: "_id",
  foreignField: "orderId"
});

rentalOrderSchema.index({
  customerId: 1,
  createdAt: -1
});

rentalOrderSchema.index({
  status: 1,
  returnDate: 1
});

rentalOrderSchema.index({
  status: 1,
  createdAt: -1
});

rentalOrderSchema.index({
  rentalDate: 1,
  returnDate: 1,
  status: 1
});

rentalOrderSchema.set("toJSON", {
  virtuals: true
});

rentalOrderSchema.set("toObject", {
  virtuals: true
});

export const RentalOrder = mongoose.model(
  "RentalOrder",
  rentalOrderSchema
);
