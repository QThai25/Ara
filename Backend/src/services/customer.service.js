import { User } from "../models/User.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { Payment } from "../models/Payment.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { CustomerAddress } from "../models/CustomerAddress.js";
import { RefundDestination } from "../models/RefundDestination.js";
import { ApiError } from "../utils/ApiError.js";
import bcrypt from "bcryptjs";
import { checkAvailability as checkScheduleAvailability } from "./costume.service.js";

const HOLDING_ORDER_STATUSES = [
  "pending",
  "pending_confirmation",
  "confirmed",
  "deposit_paid",
  "deposited",
  "paid",
  "ready_to_pickup",
  "ready_for_pickup",
  "renting",
  "overdue"
];

export async function listCustomers() {
  const customers = await User.find({ role: "customer" }).select("-password").sort({ createdAt: -1 }).lean();
  return Promise.all(customers.map(withCustomerStats));
}

export async function getCustomer(id) {
  const customer = await User.findOne({ _id: id, role: "customer" }).select("-password").lean();
  if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng.");
  return withCustomerStats(customer, true);
}

export async function createCustomer(payload) {
  await assertUniqueCustomer(payload.email, payload.phone);
  const password = await bcrypt.hash(payload.password, 10);
  const customer = await User.create({
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    password,
    role: "customer",
    status: payload.status || "active"
  });
  return getCustomer(customer._id);
}

export async function updateCustomer(id, payload) {
  const customer = await User.findOne({ _id: id, role: "customer" });
  if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng.");
  await assertUniqueCustomer(payload.email, payload.phone, id);
  ["name", "email", "phone", "status"].forEach((field) => {
    if (payload[field] !== undefined) customer[field] = payload[field];
  });
  if (payload.password) customer.password = await bcrypt.hash(payload.password, 10);
  await customer.save();
  return getCustomer(customer._id);
}

export async function setCustomerStatus(id, status) {
  if (!["active", "blocked"].includes(status)) throw new ApiError(400, "Trạng thái khách hàng không hợp lệ.");
  const customer = await User.findOneAndUpdate({ _id: id, role: "customer" }, { status }, { new: true }).select("-password");
  if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng.");
  return getCustomer(customer._id);
}

export async function deleteCustomer(id) {
  const customer = await User.findOne({ _id: id, role: "customer" });
  if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng.");
  const [orders, payments] = await Promise.all([
    RentalOrder.countDocuments({ customerId: id }),
    Payment.countDocuments({ customerId: id })
  ]);
  if (orders || payments) {
    customer.status = "blocked";
    await customer.save();
    throw new ApiError(400, "Khách hàng đã có lịch sử giao dịch, hệ thống đã khóa tài khoản thay vì xóa.");
  }
  await customer.deleteOne();
  return { id };
}

async function assertUniqueCustomer(email, phone, excludeId = null) {
  const filter = {
    role: "customer",
    $or: [{ email: String(email || "").toLowerCase() }, { phone }]
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const existed = await User.findOne(filter);
  if (existed) throw new ApiError(400, "Email hoặc số điện thoại đã được sử dụng.");
}

async function withCustomerStats(customer, includeHistory = false) {
  const filter = { customerId: customer._id };
  const [orderCount, payments, orders, addresses, refundDestinations] = await Promise.all([
    RentalOrder.countDocuments(filter),
    Payment.find({ customerId: customer._id, status: "success" }).lean(),
    includeHistory ? RentalOrder.find(filter).sort({ createdAt: -1 }).limit(10).populate({ path: "items", populate: { path: "costumeId" } }).lean() : Promise.resolve([]),
    includeHistory ? CustomerAddress.find({ userId: customer._id }).sort({ isDefault: -1, createdAt: -1 }).lean() : Promise.resolve([]),
    includeHistory ? RefundDestination.find({ userId: customer._id }).sort({ isDefault: -1, createdAt: -1 }).lean() : Promise.resolve([])
  ]);
  const totalSpent = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const safeDestinations = refundDestinations.map(item => ({ _id: item._id, type: item.type, label: item.label, bankCode: item.bankCode, bankName: item.bankName, accountHolderName: item.accountHolderName, maskedAccountNumber: item.accountNumberLast4 ? `******${item.accountNumberLast4}` : "", qrAsset: item.type === "vietqr_image" ? item.qrAsset : undefined, isDefault: item.isDefault, isEnabled: item.isEnabled }));
  return { ...customer, orderCount, totalSpent, orders, addresses, refundDestinations: safeDestinations };
}
function parseDate(value, fieldName) {
  if (!value) {
    throw new ApiError(
      400,
      `Thiếu ${fieldName}.`
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(
      400,
      `${fieldName} không hợp lệ.`
    );
  }

  return date;
}

export async function checkCostumeAvailability(
  costumeId,
  query
) {
  return checkScheduleAvailability(costumeId, query);
  /* Legacy implementation retained below temporarily for data-migration
     compatibility; every caller now delegates to the canonical schedule
     service above. */
  const costume = await Costume.findById(costumeId);

  if (!costume) {
    throw new ApiError(
      404,
      "Không tìm thấy trang phục."
    );
  }

  const rentalDate = parseDate(
    query.rentalDate,
    "ngày thuê"
  );

  const returnDate = parseDate(
    query.returnDate,
    "ngày trả"
  );

  if (returnDate < rentalDate) {
    throw new ApiError(
      400,
      "Ngày trả phải lớn hơn hoặc bằng ngày thuê."
    );
  }

  if (costume.status !== "available") {
    return {
      available: false,
      stockAvailable: false,
      totalQuantity: Number(costume.quantity || 1),
      reservedQuantity: 0,
      availableQuantity: 0,
      message:
        "Trang phục hiện không sẵn sàng để thuê."
    };
  }

  const matchedOrders = await RentalOrder.find({
    status: {
      $in: HOLDING_ORDER_STATUSES
    },
    rentalDate: {
      $lte: returnDate
    },
    returnDate: {
      $gte: rentalDate
    }
  }).select("_id");

  const orderIds = matchedOrders.map(
    (order) => order._id
  );

  if (!orderIds.length) {
    return {
      available: true,
      stockAvailable: true,
      totalQuantity: Number(costume.quantity || 1),
      reservedQuantity: 0,
      availableQuantity: Number(costume.quantity || 1),
      message:
        "Trang phục còn trống trong thời gian này."
    };
  }

  const reservedItems = await RentalOrderItem.find({
    costumeId: costume._id,
    orderId: {
      $in: orderIds
    }
  }).lean();

  const reservedQuantity = reservedItems.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 1),
    0
  );

  const totalQuantity = Number(
    costume.quantity || 1
  );

  const availableQuantity =
    totalQuantity - reservedQuantity;

  const isAvailable = availableQuantity > 0;

  return {
    available: isAvailable,
    stockAvailable: true,
    totalQuantity,
    reservedQuantity,
    availableQuantity:
      availableQuantity > 0
        ? availableQuantity
        : 0,
    message: isAvailable
      ? "Trang phục còn trống trong thời gian này."
      : "Trang phục đã có người đặt trong thời gian này."
  };
}
