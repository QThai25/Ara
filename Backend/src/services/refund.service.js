import crypto from "node:crypto";
import { DepositRefund } from "../models/DepositRefund.js";
import { RefundDestination } from "../models/RefundDestination.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { ADMIN_PERMISSIONS, hasAdminPermission, isAdminRole } from "../utils/adminPermissions.js";
import { destinationSnapshot, revealDestinationSnapshot, secureDestinationSnapshot } from "./accountAsset.service.js";
import { emitOrderUpdated } from "../realtime/socket.js";
import { buildVietQrDataUrl, buildVietQrPayload } from "./vietQr.service.js";
import { Payment } from "../models/Payment.js";
import { resolveSupportedBank } from "./bankCatalog.service.js";
import { createNotificationOnce } from "./notification.service.js";
import { getOrderFinancialSnapshot } from "./rentalOrderFinancialPolicy.service.js";
import { cloudinary } from "../config/cloudinary.js";
import sharp from "sharp";

const statuses = ["awaiting_information", "pending", "processing", "completed", "failed", "canceled"];
const code = () => `ARARF-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function allowedActions(refund) {
  return {
    viewDetails: true,
    viewMissingInformation: refund.status === "awaiting_information",
    startProcessing: refund.status === "pending",
    completeTransfer: refund.status === "processing",
    reportFailure: refund.status === "processing",
    viewTransferEvidence: refund.status === "completed",
    retry: refund.status === "failed",
    viewCancellationReason: refund.status === "canceled"
  };
}

function present(refund, { fullAccount = false } = {}) {
  const value = refund?.toObject ? refund.toObject({ virtuals: true }) : refund;
  const snapshot = value.refundDestinationSnapshot || value.destinationSnapshot;
  if (snapshot) {
    const visible = fullAccount ? revealDestinationSnapshot(snapshot) : { ...snapshot, accountNumber: undefined, encryptedAccountNumber: undefined, maskedAccountNumber: snapshot.maskedAccountNumber || `••••••${snapshot.accountNumberLast4 || ""}` };
    value.refundDestinationSnapshot = visible;
    value.destinationSnapshot = visible;
  }
  value.transferProofAssets = (value.transferProofAssets || []).map((asset) => ({
    publicId: asset.publicId,
    mimeType: asset.mimeType,
    uploadedAt: asset.uploadedAt,
    accessUrl: asset.publicId ? cloudinary.utils.private_download_url(asset.publicId, String(asset.mimeType || "image/jpeg").split("/")[1].replace("jpeg", "jpg"), { resource_type: "image", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 600 }) : ""
  }));
  return { ...value, allowedActions: allowedActions(value) };
}

function uploadPrivateProof(file, refundId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: `ara_refund_proofs/${refundId}`,
      resource_type: "image",
      type: "authenticated",
      access_mode: "authenticated",
      overwrite: false
    }, (error, result) => error ? reject(error) : resolve(result));
    stream.end(file.buffer);
  });
}

export async function uploadProof(id, file, user) {
  requireFinancial(user);
  if (!file) throw new ApiError(400, "Vui lòng chọn ảnh chứng từ.");
  let metadata;
  try { metadata = await sharp(file.buffer).metadata(); } catch { throw new ApiError(400, "Tệp tải lên không phải ảnh hợp lệ."); }
  const actualMime = ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[metadata.format];
  if (!actualMime) throw new ApiError(400, "Chứng từ chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP.");
  const refund = await DepositRefund.findOne({ _id: id, status: "processing" });
  if (!refund) throw new ApiError(409, "Chỉ được tải chứng từ khi khoản hoàn đang được xử lý.");
  if ((refund.transferProofAssets || []).length >= 5) throw new ApiError(400, "Chỉ được tải tối đa 5 ảnh chứng từ.");
  const uploaded = await uploadPrivateProof({ ...file, mimetype: actualMime }, id);
  const asset = { publicId: uploaded.public_id, mimeType: actualMime, uploadedBy: user._id, uploadedAt: new Date() };
  const updated = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "processing", "transferProofAssets.4": { $exists: false } },
    { $push: { transferProofAssets: asset, auditTrail: { actorId: user._id, role: user.role, action: "refund.proof_uploaded" } } },
    { new: true }
  );
  if (!updated) {
    await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: "image", type: "authenticated", invalidate: true }).catch(() => {});
    throw new ApiError(409, "Khoản hoàn vừa thay đổi trạng thái hoặc đã đủ số chứng từ.");
  }
  return detail(id);
}

async function ownedOrder(id, user) {
  const order = await RentalOrder.findById(id);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  const guestOwnsOrder = user?.role === "guest" && String(user.guestOrderId) === String(order._id);
  if (
    String(order.customerId) !== String(user._id) &&
    !hasAdminPermission(user, ADMIN_PERMISSIONS.REFUNDS_VIEW_SENSITIVE) &&
    !guestOwnsOrder
  ) {
    throw new ApiError(403, "Bạn không có quyền xem thông tin hoàn cọc này.");
  }
  return order;
}

export async function captureDestinationInput(orderId, body, user) {
  const order = await ownedOrder(orderId, user);
  if (await DepositRefund.exists({ orderId, status: { $nin: ["awaiting_information", "pending"] } })) throw new ApiError(409, "Khoản hoàn cọc đã bắt đầu xử lý nên không thể đổi tài khoản.");
  const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
  const accountName = String(body.accountName || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!/^\d{6}$/.test(String(body.bankBin || "")) || !/^[A-Za-z0-9]{6,24}$/.test(accountNumber) || !accountName) throw new ApiError(400, "Thông tin tài khoản nhận hoàn cọc không hợp lệ.");
  const bank = await resolveSupportedBank(body.bankBin);
  const snapshot = secureDestinationSnapshot({ method: "bank_account", bankBin: bank.bin, bankCode: bank.code, bankName: bank.name, accountNumber, accountName, inputMethod: body.inputMethod === "uploaded_vietqr" ? "uploaded_vietqr" : "manual", verificationStatus: "unverified", confirmedAt: new Date(), capturedAt: new Date(), source: "checkout_input" });
  const before = revealDestinationSnapshot(order.refundDestinationSnapshot);
  order.refundDestinationSnapshot = snapshot; order.needsRefundInformation = false;
  order.refundDestinationAudit.push({ actorId: user?._id || null, role: user?.role || "guest", action: "refund_destination.changed", source: "checkout_input", before: before ? { bankBin: before.bankBin, maskedAccountNumber: before.maskedAccountNumber, accountName: before.accountName } : null, after: { bankBin: bank.bin, maskedAccountNumber: `••••••${accountNumber.slice(-4)}`, accountName } });
  await order.save();
  return { ...snapshot, encryptedAccountNumber: undefined };
}

export async function ensureRefund(order, inspection, actor) {
  const amount = Number(order.refundAmount || 0);
  if (amount <= 0) return null;
  const old = await DepositRefund.findOne({ orderId: order._id, status: { $nin: ["failed", "canceled"] } });
  if (old) return old;
  const storedSnapshot = order.refundDestinationSnapshot || null;
  const snapshot = revealDestinationSnapshot(storedSnapshot);
  const status = snapshot?.bankBin && snapshot?.accountNumber && snapshot?.accountName ? "pending" : "awaiting_information";
  const depositPayments = await Payment.find({ orderId: order._id, paymentType: { $in: ["deposit", "full"] }, status: "success" }).select("_id").lean();
  const refundCode = code();
  const qrInput = status === "pending" ? { bankBin: snapshot.bankBin, accountNumber: snapshot.accountNumber, amount, description: refundCode } : null;
  let refund;
  try {
    refund = await DepositRefund.create({
      refundCode, orderId: order._id, customerId: order.customerId,
      sourceDepositPaymentIds: depositPayments.map((item) => item._id), depositPaymentIds: depositPayments.map((item) => item._id), amount, status,
      destinationType: snapshot ? "bank_account" : null,
      destinationSnapshot: storedSnapshot, refundDestinationSnapshot: storedSnapshot,
      refundQrPayload: qrInput ? buildVietQrPayload(qrInput) : "",
      refundQrDataUrl: qrInput ? await buildVietQrDataUrl(qrInput) : "",
      refundQrGeneratedAt: qrInput ? new Date() : null,
      initiatedBy: actor, idempotencyKey: `settlement:${order._id}:${inspection._id}`,
      auditTrail: [{ actorId: actor, action: "refund.created" }]
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    refund = await DepositRefund.findOne({ idempotencyKey: `settlement:${order._id}:${inspection._id}` });
    if (!refund) throw error;
  }
  order.settlementStatus = "pending_refund";
  await order.save();
  return refund;
}

export async function getOrderRefund(orderId, user) {
  await ownedOrder(orderId, user);
  const refund = await DepositRefund.findOne({ orderId }).sort({ createdAt: -1 });
  return refund ? present(refund) : null;
}

export async function selectDestination(orderId, destinationId, user) {
  const order = await ownedOrder(orderId, user);
  if (isAdminRole(user.role)) throw new ApiError(403, "Admin phải dùng luồng override có kiểm soát.");
  const destination = await RefundDestination.findOne({ _id: destinationId, userId: user._id, isEnabled: true }).select("+encryptedAccountNumber");
  if (!destination) throw new ApiError(404, "Điểm nhận hoàn cọc không tồn tại hoặc đã tắt.");
  const snapshot = destinationSnapshot(destination, "customer_profile");
  const storedSnapshot = secureDestinationSnapshot(snapshot);
  const refund = await DepositRefund.findOne({ orderId, status: { $in: ["awaiting_information", "pending"] } });
  if (!refund && await DepositRefund.exists({ orderId, status: { $nin: ["awaiting_information", "pending"] } })) throw new ApiError(409, "Khoản hoàn cọc đã bắt đầu xử lý nên không thể đổi tài khoản.");
  const before = revealDestinationSnapshot(order.refundDestinationSnapshot);
  order.refundDestinationSnapshot = storedSnapshot;
  order.needsRefundInformation = false;
  order.refundDestinationAudit.push({ actorId: user._id, role: user.role, action: "refund_destination.changed", source: "customer_profile", before: before ? { bankBin: before.bankBin, maskedAccountNumber: before.maskedAccountNumber, accountName: before.accountName } : null, after: { bankBin: snapshot.bankBin, maskedAccountNumber: snapshot.maskedAccountNumber, accountName: snapshot.accountName } });
  await order.save();
  if (!refund) return { orderId: order._id, refundDestinationSnapshot: { ...snapshot, accountNumber: undefined }, status: "captured" };
  refund.destinationId = destination._id;
  refund.destinationType = "bank_account";
  refund.destinationSnapshot = storedSnapshot;
  refund.refundDestinationSnapshot = storedSnapshot;
  refund.refundQrPayload = buildVietQrPayload({ bankBin: snapshot.bankBin, accountNumber: snapshot.accountNumber, amount: refund.amount, description: refund.refundCode });
  refund.refundQrDataUrl = await buildVietQrDataUrl({ bankBin: snapshot.bankBin, accountNumber: snapshot.accountNumber, amount: refund.amount, description: refund.refundCode });
  refund.refundQrGeneratedAt = new Date();
  refund.status = "pending";
  refund.auditTrail.push({ actorId: user._id, role: user.role, action: "refund.destination_changed" });
  return present(await refund.save());
}

export async function list(filter = {}) {
  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const query = {};
  if (filter.status && statuses.includes(filter.status)) query.status = filter.status;

  const search = String(filter.search || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const [orders, customers] = await Promise.all([
      RentalOrder.find({ orderCode: regex }).select("_id").lean(),
      User.find({ $or: [{ name: regex }, { phone: regex }] }).select("_id").lean()
    ]);
    query.$or = [
      { refundCode: regex },
      { orderId: { $in: orders.map((item) => item._id) } },
      { customerId: { $in: customers.map((item) => item._id) } }
    ];
  }

  const [rows, total, summaryRows] = await Promise.all([
    DepositRefund.find(query)
      .populate("orderId", "orderCode depositDeduction refundAmount")
      .populate("customerId", "name phone")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit).limit(limit),
    DepositRefund.countDocuments(query),
    DepositRefund.aggregate([{ $match: query }, { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }])
  ]);
  const summary = Object.fromEntries(statuses.map((status) => [status, { count: 0, amount: 0 }]));
  for (const row of summaryRows) if (summary[row._id]) summary[row._id] = { count: row.count, amount: row.amount };
  return {
    items: rows.map((row) => present(row)), summary,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

export async function detail(id) {
  const refund = await DepositRefund.findById(id).populate("orderId").populate("customerId", "name phone email");
  if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn cọc.");
  return present(refund, { fullAccount: true });
}

function requireFinancial(user) {
  if (!hasAdminPermission(user, ADMIN_PERMISSIONS.REFUNDS_PROCESS)) {
    throw new ApiError(403, "Chỉ Chủ tiệm được xử lý hoàn cọc.");
  }
}

export async function start(id, user) {
  requireFinancial(user);
  const refund = await DepositRefund.findOneAndUpdate({ _id: id, status: "pending", "refundDestinationSnapshot.bankBin": { $ne: "" }, "refundDestinationSnapshot.encryptedAccountNumber": { $ne: "" } }, { $set: { status: "processing", processedBy: user._id, processingAt: new Date(), processedAt: new Date() }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.started" } } }, { new: true });
  if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn cọc.");
  return detail(id);
}

export async function requestInformation(id, user) {
  requireFinancial(user);
  const refund = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "awaiting_information" },
    { $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.information_requested" } } },
    { new: true }
  );
  if (!refund) throw new ApiError(409, "Khoản hoàn không còn chờ thông tin tài khoản.");
  await createNotificationOnce({ recipientId: refund.customerId, recipientRole: "customer", type: "refund_information_required", title: "Cần bổ sung tài khoản nhận hoàn cọc", message: "ARA cần bạn bổ sung tài khoản ngân hàng hoặc VietQR nhận tiền để xử lý hoàn cọc.", entityType: "deposit_refund", entityId: refund._id, orderId: refund.orderId, actionUrl: `/my-rentals/${refund.orderId}`, priority: "high", requiresAction: true, eventKey: `refund:${refund._id}:information_requested` });
  return detail(id);
}

export async function complete(id, body, user) {
  requireFinancial(user);
  const refund = await DepositRefund.findById(id);
  if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn cọc.");
  if (refund.status === "completed") throw new ApiError(409, "Khoản hoàn cọc đã hoàn tất và không thể xác nhận lại.");
  if (refund.status !== "processing") throw new ApiError(409, "Phải bắt đầu xử lý trước khi hoàn tất.");
  const transactionReference = String(body.transactionReference || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!transactionReference && !refund.transferProofAssets?.length) {
    throw new ApiError(400, "Cần mã giao dịch hoặc ít nhất một ảnh chứng từ.");
  }
  if (!refund.refundDestinationSnapshot?.encryptedAccountNumber || !refund.refundDestinationSnapshot?.bankBin) throw new ApiError(409, "Khoản hoàn cọc chưa có tài khoản nhận tiền hợp lệ.");
  const order = await RentalOrder.findById(refund.orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê của khoản hoàn cọc.");
  const [payments, refunds] = await Promise.all([
    Payment.find({ orderId: order._id }).lean(),
    DepositRefund.find({ orderId: order._id }).lean()
  ]);
  const financial = getOrderFinancialSnapshot(order, payments, refunds);
  if (financial.needsFinancialReview || financial.refundableDepositAmount !== Number(refund.amount || 0)) {
    throw new ApiError(409, "Số tiền hoàn không còn khớp với quyết toán hiện tại. Vui lòng kiểm tra lại đơn thuê.");
  }
  if (transactionReference && await DepositRefund.exists({ _id: { $ne: refund._id }, transactionReference })) {
    throw new ApiError(409, "Mã giao dịch này đã được sử dụng cho một khoản hoàn khác.");
  }
  const completedAt = new Date();
  let completedRefund;
  try {
    completedRefund = await DepositRefund.findOneAndUpdate(
      { _id: id, status: "processing", amount: refund.amount },
      { $set: { status: "completed", transactionReference, transferredAt: new Date(body.transferredAt || Date.now()), note: body.note || "", completedBy: user._id, completedAt }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.completed" } } },
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "Mã giao dịch này đã được sử dụng cho một khoản hoàn khác.");
    throw error;
  }
  if (!completedRefund) throw new ApiError(409, "Khoản hoàn cọc đã được xử lý bởi yêu cầu khác.");
  if (order) {
    order.refundAmount = 0; order.refundedAt = completedRefund.completedAt;
    if (Number(order.outstandingPenalty || 0) === 0) order.settlementStatus = "settled";
    await order.save();
    emitOrderUpdated({ orderId: order._id, customerId: order.customerId, status: order.status, paymentStatus: order.paymentStatus, reason: "refund_completed" });
    await createNotificationOnce({ recipientId: order.customerId, recipientRole: "customer", type: "payment_refund_completed", title: "ARA đã hoàn tiền cọc", message: `${Number(completedRefund.amount || 0).toLocaleString("vi-VN")} ₫ đã được hoàn. Mã giao dịch: ${completedRefund.transactionReference || "xem chứng từ trong đơn"}.`, entityType: "deposit_refund", entityId: completedRefund._id, orderId: order._id, actionUrl: `/my-rentals/${order._id}`, priority: "normal", eventKey: `refund:${completedRefund._id}:completed:customer`, metadata: { amount: completedRefund.amount } });
    if (order.status === "returned") {
      const { completeOrder } = await import("./rentalOrder.service.js");
      await completeOrder(order._id);
    }
  }
  return detail(id);
}

export async function fail(id, body, user) {
  requireFinancial(user);
  const failureReason = String(body.reason || "").trim();
  if (!failureReason) throw new ApiError(400, "Vui lòng nhập lý do thất bại.");
  const refund = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "processing" },
    { $set: { status: "failed", failureReason, failedBy: user._id, failedAt: new Date() }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.failed", reason: failureReason } } },
    { new: true }
  );
  if (!refund) throw new ApiError(409, "Chỉ khoản đang xử lý mới được đánh dấu thất bại.");
  return detail(id);
}

export async function cancel(id, body, user) {
  requireFinancial(user);
  const reason = String(body.reason || "").trim();
  const refund = await DepositRefund.findOneAndUpdate(
    { _id: id, status: { $in: ["awaiting_information", "pending"] } },
    { $set: { status: "canceled", canceledReason: reason }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.canceled", reason } } },
    { new: true }
  );
  if (!refund) throw new ApiError(409, "Không thể hủy khoản hoàn ở trạng thái hiện tại.");
  return detail(id);
}

export async function retry(id, user) {
  requireFinancial(user);
  const refund = await DepositRefund.findOneAndUpdate({ _id: id, status: "failed", "refundDestinationSnapshot.encryptedAccountNumber": { $ne: "" } }, { $set: { status: "pending", failureReason: "", failedAt: null, failedBy: null }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.retried" } } }, { new: true });
  if (!refund) throw new ApiError(409, "Khoản hoàn không thể thử lại ở trạng thái hiện tại.");
  return detail(id);
}

export async function overrideDestination(id, body, user) {
  requireFinancial(user);
  const reason = String(body.reason || "").trim();
  if (reason.length < 5) throw new ApiError(400, "Bắt buộc nhập lý do thay đổi tài khoản.");
  const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
  const accountName = String(body.accountName || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!/^\d{6}$/.test(String(body.bankBin || "")) || !/^[A-Za-z0-9]{6,24}$/.test(accountNumber) || !accountName) throw new ApiError(400, "Thông tin tài khoản thay thế không hợp lệ.");
  const bank = await resolveSupportedBank(body.bankBin);
  const refund = await DepositRefund.findOne({ _id: id, status: "processing" });
  if (!refund) throw new ApiError(409, "Chỉ được override khoản hoàn đang xử lý.");
  const before = revealDestinationSnapshot(refund.refundDestinationSnapshot);
  const next = { method: "bank_account", bankBin: bank.bin, bankCode: bank.code, bankName: bank.name, accountNumber, maskedAccountNumber: `••••••${accountNumber.slice(-4)}`, accountName, inputMethod: "manual", verificationStatus: "unverified", confirmedAt: new Date(), capturedAt: new Date(), source: "admin_override" };
  const storedNext = secureDestinationSnapshot(next);
  const refundQrPayload = buildVietQrPayload({ bankBin: next.bankBin, accountNumber, amount: refund.amount, description: refund.refundCode });
  const refundQrDataUrl = await buildVietQrDataUrl({ bankBin: next.bankBin, accountNumber, amount: refund.amount, description: refund.refundCode });
  const updated = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "processing" },
    { $set: { refundDestinationSnapshot: storedNext, destinationSnapshot: storedNext, refundQrPayload, refundQrDataUrl }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.destination_overridden", reason, before: { ...before, accountNumber: undefined }, after: { ...next, accountNumber: undefined } } } },
    { new: true, runValidators: true }
  );
  if (!updated) throw new ApiError(409, "Khoản hoàn cọc vừa được xử lý bởi yêu cầu khác.");
  return detail(id);
}
