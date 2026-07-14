import { RentalOrder } from "../models/RentalOrder.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { RentalCredit } from "../models/RentalCredit.js";
import { RentalExchange } from "../models/RentalExchange.js";
import { PickupIssue } from "../models/PickupIssue.js";
import { Costume } from "../models/Costume.js";
import { Payment } from "../models/Payment.js";
import { AuditLog } from "../models/AuditLog.js";
import { ApiError } from "../utils/ApiError.js";
import { RENTAL_POLICY, calculateExtraDayFee } from "../config/rentalPolicy.js";
import { assertNoScheduleConflict } from "./costume.service.js";

const adminRoles = ["admin", "staff", "owner"];
const requireOrder = async id => {
  const order = await RentalOrder.findById(id);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  return order;
};
const audit = (actorId, action, order, before, after, reason = "") => AuditLog.create({ actorId, action, entityType: "rental_order", entityId: order._id, before, after, reason });

export async function confirmDeposit(orderId, input, actorId) {
  const order = await requireOrder(orderId);
  const method = input.method;
  if (!["partial_cash", "full_rental", "original_id"].includes(method)) throw new ApiError(400, "Hình thức cọc không hợp lệ.");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, "Admin phải xác nhận số tiền cọc thực tế.");
  if (method !== "original_id" && amount <= 0) throw new ApiError(400, "Số tiền cọc phải lớn hơn 0.");
  const before = order.deposit?.toObject?.() || order.deposit;
  order.deposit = { ...before, method, amount, status: "received", note: input.note || "", confirmedBy: actorId, confirmedAt: new Date(), originalIdReceivedAt: method === "original_id" ? new Date(input.originalIdReceivedAt || Date.now()) : null };
  order.totalDepositAmount = amount;
  await order.save(); await audit(actorId, "deposit.confirm", order, before, order.deposit, input.note);
  return order;
}

export async function returnOriginalId(orderId, actorId) {
  const order = await requireOrder(orderId);
  if (order.deposit?.method !== "original_id" || !order.deposit.originalIdReceivedAt) throw new ApiError(400, "Đơn chưa ghi nhận CCCD bản gốc.");
  order.deposit.originalIdReturnedAt = new Date(); order.deposit.status = "released"; await order.save();
  await audit(actorId, "deposit.original_id_return", order, null, { at: order.deposit.originalIdReturnedAt }); return order;
}

export async function updateLogistics(orderId, input, actorId) {
  const order = await requireOrder(orderId); const before = order.schedule?.toObject?.() || order.schedule;
  for (const key of ["pickupAt", "mainWearDate", "dueReturnAt", "actualReturnAt", "shopShippedAt", "customerReceivedAt", "customerReturnShippedAt", "shopReceivedBackAt"]) if (input[key] !== undefined) order.schedule[key] = input[key] ? new Date(input[key]) : null;
  if (input.isOutOfProvince !== undefined) order.schedule.isOutOfProvince = Boolean(input.isOutOfProvince);
  const outboundFee = Math.max(0, Number(input.outboundFee ?? order.shipping.outboundFee) || 0); const returnFee = Math.max(0, Number(input.returnFee ?? order.shipping.returnFee) || 0);
  order.shipping = { outboundFee, returnFee, totalFee: outboundFee + returnFee }; await order.save();
  await audit(actorId, "logistics.update", order, before, { schedule: order.schedule, shipping: order.shipping }); return order;
}

export async function confirmExtraDays(orderId, input, actorId) {
  const order = await requireOrder(orderId); const days = Math.trunc(Number(input.extraDays));
  if (days < 1) throw new ApiError(400, "Số ngày thuê thêm không hợp lệ.");
  const noticeGiven = Boolean(input.noticeGiven); const impacts = !noticeGiven && Boolean(input.impactsNextRental);
  const suggestedAmount = impacts ? Number(order.totalRentalPrice || 0) : calculateExtraDayFee(order.totalRentalPrice, days, noticeGiven);
  let finalAmount = suggestedAmount;
  if (impacts) { finalAmount = Number(input.finalAmount); if (!Number.isFinite(finalAmount) || finalAmount < 0 || !String(input.reason || "").trim()) throw new ApiError(400, "Admin phải nhập số tiền cuối cùng và lý do khi ảnh hưởng lịch khách tiếp theo."); }
  order.extraDayCharge = { extraDays: days, noticeGiven, impactsNextRental: impacts, suggestedAmount, finalAmount, reason: input.reason || "", confirmedBy: actorId, confirmedAt: new Date() };
  await order.save(); await audit(actorId, "extra_days.confirm", order, null, order.extraDayCharge, input.reason); return order;
}

export async function exchangeCostume(orderId, input, actorId) {
  const order = await requireOrder(orderId); const now = Date.now();
  if (order.status !== "renting" || !order.pickedUpAt) throw new ApiError(400, "Chỉ đổi mẫu sau khi khách nhận đồ.");
  if (order.exchangeCount >= RENTAL_POLICY.maxExchangeCount) throw new ApiError(400, "Đơn đã sử dụng lượt đổi mẫu.");
  if (now - new Date(order.pickedUpAt).getTime() > RENTAL_POLICY.exchangeWindowMinutes * 60000) throw new ApiError(400, "Đã quá thời hạn đổi mẫu 30 phút.");
  const item = await RentalOrderItem.findOne({ orderId, costumeId: input.oldCostumeId }); const costume = await Costume.findById(input.newCostumeId);
  if (!item || !costume) throw new ApiError(404, "Không tìm thấy mẫu cần đổi.");
  await assertNoScheduleConflict(costume._id, order.rentalDate, order.returnDate, order._id, null, item.quantity);
  const oldPrice = Number(item.subtotal || 0); const rentalUnits = Number(item.rentalPricePerDay) > 0 ? oldPrice / Number(item.rentalPricePerDay) : item.quantity; const newPrice = Number(costume.rentalPricePerDay || 0) * rentalUnits; const difference = Math.max(0, newPrice - oldPrice);
  const oldCostumeId = item.costumeId; item.costumeId = costume._id; item.rentalPricePerDay = Number(costume.rentalPricePerDay || 0); item.subtotal = Math.max(oldPrice, newPrice); await item.save();
  order.exchangeCount += 1; order.totalRentalPrice += difference; await order.save();
  await RentalExchange.create({ orderId, oldCostumeId, newCostumeId: costume._id, oldPrice, newPrice, difference, approvedBy: actorId }); return order;
}

export async function reportPickupIssue(orderId, input, user) {
  const order = await requireOrder(orderId); if (String(order.customerId) !== String(user._id)) throw new ApiError(403, "Bạn không có quyền báo vấn đề cho đơn này.");
  if (!order.pickedUpAt || Date.now() - new Date(order.pickedUpAt).getTime() > RENTAL_POLICY.exchangeWindowMinutes * 60000) throw new ApiError(400, "Đã quá thời hạn báo vấn đề ban đầu 30 phút.");
  if (!Array.isArray(input.evidenceUrls) || !input.evidenceUrls.length) throw new ApiError(400, "Cần ít nhất một ảnh hoặc video bằng chứng.");
  return PickupIssue.create({ orderId, customerId: user._id, issueType: input.issueType, description: input.description, evidenceUrls: input.evidenceUrls });
}
export const listIssues = orderId => PickupIssue.find({ orderId }).populate("handledBy", "name").sort({ createdAt: -1 });
export async function listIssuesForUser(orderId, user) { const order = await requireOrder(orderId); if (!adminRoles.includes(user.role) && String(order.customerId) !== String(user._id)) throw new ApiError(403, "Bạn không có quyền xem báo cáo của đơn này."); return listIssues(orderId); }
export async function handleIssue(orderId, issueId, input, actorId) { const issue = await PickupIssue.findOne({ _id: issueId, orderId }); if (!issue) throw new ApiError(404, "Không tìm thấy báo cáo."); issue.status = input.status; issue.resolutionNote = input.resolutionNote || ""; issue.handledBy = actorId; issue.handledAt = new Date(); await issue.save(); return issue; }

export async function applyCredit(orderId, input, user) {
  const order = await requireOrder(orderId); const actorId = user._id; const amount = Number(input.amount);
  if (!adminRoles.includes(user.role) && String(order.customerId) !== String(actorId)) throw new ApiError(403, "Bạn không có quyền dùng số dư cho đơn này.");
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Số tiền sử dụng không hợp lệ.");
  const credit = await RentalCredit.findOneAndUpdate({ _id: input.creditId, customerId: order.customerId, remainingAmount: { $gte: amount } }, { $inc: { remainingAmount: -amount }, $push: { usages: { orderId, amount, appliedBy: actorId, appliedAt: new Date() } } }, { new: true });
  if (!credit) throw new ApiError(409, "Số dư không tồn tại hoặc không đủ."); credit.status = credit.remainingAmount === 0 ? "used" : "partially_used"; await credit.save(); order.creditAppliedAmount += amount; await order.save(); await audit(actorId, "credit.apply", order, null, { creditId: credit._id, amount }); return { order, credit };
}
export const listCredits = customerId => RentalCredit.find({ customerId, remainingAmount: { $gt: 0 } }).sort({ createdAt: 1 });

export async function settleDeposit(orderId, input, actorId) {
  const order = await requireOrder(orderId); const fees = Math.max(0, Number(input.totalIncidentalFees) || 0); const held = Math.max(0, Number(order.deposit?.amount || order.totalDepositAmount) || 0); const deduction = Number(input.deductedAmount);
  if (!Number.isFinite(deduction) || deduction < 0 || deduction > held || deduction > fees) throw new ApiError(400, "Số tiền đối trừ không hợp lệ.");
  const customerPayable = fees - deduction; const remainingDeposit = held - deduction; order.settlement = { totalIncidentalFees: fees, heldDeposit: held, deductedAmount: deduction, customerPayable, remainingDeposit, confirmedBy: actorId, confirmedAt: new Date() }; await order.save();
  await audit(actorId, "deposit.settle", order, null, order.settlement, input.reason || "");
  if (customerPayable > 0 && !(await Payment.exists({ orderId, paymentType: "penalty", active: true }))) await Payment.create({ orderId, customerId: order.customerId, paymentType: "penalty", channel: "direct", method: "cash", amount: customerPayable, status: "awaiting_confirmation", active: true, paymentGroup: "settlement", provider: "manual", paymentReference: `PEN-${order._id}-${Date.now()}` });
  return order;
}

export async function immediateReturn(orderId, actorId) {
  const order = await requireOrder(orderId);
  if (order.status !== "renting" || !order.pickedUpAt) throw new ApiError(400, "Chỉ áp dụng khi khách vừa nhận và trả đồ ngay.");
  if (Date.now() - new Date(order.pickedUpAt).getTime() > RENTAL_POLICY.exchangeWindowMinutes * 60000) throw new ApiError(400, "Đã quá thời hạn 30 phút.");
  const amount = Math.round(Number(order.totalRentalPrice || 0) * RENTAL_POLICY.immediateReturnRate);
  order.immediateReturnCharge = amount; order.actualReturnDate = new Date(); order.returnedAt = order.actualReturnDate; order.status = "returned"; await order.save();
  await audit(actorId, "rental.immediate_return", order, null, { rate: RENTAL_POLICY.immediateReturnRate, amount }); return order;
}
