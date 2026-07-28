import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalOrder",
      required: true,
      index: true
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    /*
     * deposit: thanh toán tiền cọc
     * full: thanh toán toàn bộ
     * penalty: thanh toán phí phạt sau trả đồ
     */
    paymentType: {
      type: String,
      enum: ["deposit", "full", "rental_balance", "penalty", "refund"],
      required: true,
      index: true
    },

    /*
     * online:
     * - MoMo
     * - cổng ngân hàng
     *
     * direct:
     * - tiền mặt tại cửa hàng
     * - chuyển khoản trực tiếp cho cửa hàng
     */
    channel: {
      type: String,
      enum: ["online", "direct"],
      required: true,
      index: true
    },

    method: {
      type: String,
      enum: [
        "momo",
        "vnpay",
        "payos",
        "bank_gateway",
        "bank_transfer",
        "cash"
      ],
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    currency: { type: String, enum: ["VND"], default: "VND" },

    status: {
      type: String,
      enum: [
        "pending",
        "awaiting_confirmation",
        "success",
        "failed",
        "canceled",
        "expired",
        "refunded"
      ],
      default: "pending",
      index: true
    },

    active: {
      type: Boolean,
      default: true,
      index: true
    },

    paymentGroup: {
      type: String,
      enum: ["rental", "settlement"],
      required: true,
      index: true
    },

    /*
     * momo: thanh toán qua MoMo
     * bank: thanh toán qua cổng ngân hàng
     * manual: tiền mặt hoặc chuyển khoản trực tiếp
     */
    provider: {
      type: String,
      enum: ["momo", "vnpay", "payos", "bank", "manual"],
      required: true
    },

    /*
     * Mã giao dịch do hệ thống mình tạo để gửi sang provider.
     *
     * Không đặt default: "" vì unique index sẽ làm nhiều
     * payment manual bị trùng chuỗi rỗng.
     */
    providerOrderId: {
      type: String,
      trim: true
    },

    providerOrderCode: { type: Number },

    /*
     * Mã giao dịch do MoMo/ngân hàng trả về.
     */
    providerTransactionId: {
      type: String,
      trim: true
    },

    /*
     * URL chuyển người dùng tới trang thanh toán.
     */
    payUrl: {
      type: String,
      default: ""
    },

    qrCodeUrl: { type: String, default: "" },
    qrCode: { type: String, default: "", select: false },
    returnUrl: { type: String, default: "" },
    cancelUrl: { type: String, default: "" },

    /*
     * Request ID gửi sang provider.
     */
    requestId: {
      type: String,
      trim: true
    },

    /*
     * Nội dung chuyển khoản hoặc mã tham chiếu
     * dành cho thanh toán trực tiếp.
     */
    paymentReference: {
      type: String,
      trim: true
    },

    transferInstructions: {
      bankName: { type: String, trim: true },
      branch: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      accountHolder: { type: String, trim: true },
      accountName: { type: String, trim: true },
      qrUrl: { type: String, trim: true }
    },
    proofUrl: { type: String, default: "", trim: true },
    proofSubmittedAt: { type: Date, default: null },

    /*
     * Chỉ dùng cho direct payment.
     * Người admin/staff xác nhận đã nhận tiền.
     */
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    confirmedAt: {
      type: Date,
      default: null
    },

    paidAt: {
      type: Date,
      default: null
    },

    expiredAt: {
      type: Date,
      default: null
    },

    canceledAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },

    expiresAt: {
      type: Date,
      default: null,
      index: true
    },

    /*
     * Nội dung callback/IPN gốc.
     * Dùng kiểm tra khi có tranh chấp hoặc debug.
     */
    rawCallback: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false
    },

    rawRequest: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null, select: false },

    /*
     * Khóa chống tạo lặp payment khi người dùng
     * nhấn nút thanh toán nhiều lần.
     */
    idempotencyKey: {
      type: String,
      trim: true
    },

    failureReason: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

/*
 * Chỉ áp dụng unique khi providerOrderId thực sự có giá trị.
 * Payment tiền mặt/chuyển khoản trực tiếp không cần field này.
 */
paymentSchema.index(
  {
    provider: 1,
    providerOrderId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      providerOrderId: {
        $type: "string",
        $gt: ""
      }
    }
  }
);

paymentSchema.index({ provider: 1, providerOrderCode: 1 }, { unique: true, partialFilterExpression: { providerOrderCode: { $type: "number" } } });
paymentSchema.index({ provider: 1, providerTransactionId: 1 }, { unique: true, partialFilterExpression: { providerTransactionId: { $type: "string", $gt: "" } } });

/*
 * Một idempotencyKey không được tạo hai payment.
 */
paymentSchema.index(
  {
    idempotencyKey: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
        $gt: ""
      }
    }
  }
);

/*
 * Tăng tốc lấy lịch sử giao dịch của đơn.
 */
paymentSchema.index({
  customerId: 1,
  createdAt: -1
});

paymentSchema.index({
  orderId: 1,
  createdAt: -1
});

paymentSchema.index({
  orderId: 1,
  paymentType: 1,
  status: 1
});

paymentSchema.index({
  status: 1,
  channel: 1,
  createdAt: -1
});

paymentSchema.index({
  status: 1,
  paymentType: 1,
  paidAt: -1
});

paymentSchema.index({
  status: 1,
  method: 1,
  paidAt: -1
});

paymentSchema.index(
  { orderId: 1, paymentType: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

paymentSchema.index(
  { orderId: 1, paymentGroup: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

paymentSchema.index(
  { paymentReference: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentReference: { $type: "string", $gt: "" } }
  }
);

/*
 * Tăng tốc danh sách thanh toán trực tiếp
 * đang chờ admin xác nhận.
 */
paymentSchema.index({
  channel: 1,
  status: 1,
  createdAt: -1
});

export const Payment = mongoose.model(
  "Payment",
  paymentSchema
);
