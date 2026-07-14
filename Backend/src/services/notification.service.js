import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { emitNotification } from "../realtime/socket.js";
import { NOTIFICATION_ACTION_TYPES, NOTIFICATION_SUBTYPES, notificationTaxonomy, typesForTaxonomy } from "../utils/notificationTaxonomy.js";

const SAFE_METADATA_KEYS = new Set([
  "orderCode", "paymentReference", "customerName", "customerEmail", "customerPhone", "amount",
  "rentalDate", "returnDate", "lateFee", "damageFee"
]);

const safeMetadata = (metadata = {}) => Object.fromEntries(Object.entries(metadata).filter(([key]) => SAFE_METADATA_KEYS.has(key)));
const recipientFilter = (userId) => ({ $or: [{ recipientId: userId }, { recipientId: null, userId }] });
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function serialize(notification) {
  const value = notification?.toObject ? notification.toObject() : notification;
  const taxonomy = notificationTaxonomy(value.type, value.recipientRole);
  const legacyTaxonomy = !value.category || !value.subtype;
  const entityId = value.entityId || value.targetId || value.orderId || value.paymentId;
  const adminRecipient = ["admin", "staff", "owner"].includes(value.recipientRole);
  const fallbackDeeplink = !entityId ? ""
    : value.entityType === "payment" && value.paymentId ? (adminRecipient ? `/payments?paymentId=${value.paymentId}` : `/my-payments/${value.paymentId}`)
    : adminRecipient ? `/orders/${value.orderId || entityId}` : `/my-rentals/${value.orderId || entityId}`;
  const deeplink = value.actionUrl || fallbackDeeplink;
  return {
    ...value,
    recipientId: value.recipientId || value.userId,
    message: value.message || value.content,
    category: value.category || taxonomy.category,
    subtype: value.subtype || taxonomy.subtype,
    requiresAction: legacyTaxonomy ? Boolean(value.requiresAction || taxonomy.requiresAction) : Boolean(value.requiresAction),
    actionUrl: deeplink,
    deeplink,
    metadata: safeMetadata(value.metadata)
  };
}

export async function getUnreadCount(recipientId) {
  return Notification.countDocuments({ ...recipientFilter(recipientId), isRead: false });
}

export async function createNotificationOnce(values, { session = null } = {}) {
  const recipientId = values.recipientId || values.userId;
  if (!recipientId) return null;
  const recipientRole = values.recipientRole || "customer";
  const taxonomy = notificationTaxonomy(values.type, recipientRole);
  const payload = {
    ...values,
    ...taxonomy,
    category: values.category || taxonomy.category,
    subtype: values.subtype || taxonomy.subtype,
    requiresAction: values.requiresAction ?? taxonomy.requiresAction,
    recipientId,
    recipientRole,
    userId: recipientId,
    message: values.message || values.content,
    content: values.message || values.content,
    entityId: values.entityId || values.targetId || values.orderId || values.paymentId || values.inspectionId,
    targetId: values.entityId || values.targetId || values.orderId || values.paymentId || values.inspectionId,
    targetType: values.entityType || values.targetType || "system",
    actionUrl: values.actionUrl || values.deeplink || "",
    metadata: safeMetadata(values.metadata)
  };
  const query = { recipientId, eventKey: payload.eventKey };
  try {
    const notification = await Notification.findOneAndUpdate(query, { $setOnInsert: payload }, {
      upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {})
    });
    if (!session && notification.createdAt?.getTime() === notification.updatedAt?.getTime()) {
      emitNotification(serialize(notification), await getUnreadCount(recipientId));
    }
    return notification;
  } catch (error) {
    if (error?.code === 11000) return Notification.findOne(query);
    throw error;
  }
}

export async function notifyUser(recipient, values, options = {}) {
  const recipientId = recipient?._id || recipient;
  return createNotificationOnce({ ...values, recipientId, recipientRole: recipient?.role || values.recipientRole || "customer" }, options);
}

export async function notifyRoles(roles, values, options = {}) {
  const users = await User.find({ role: { $in: roles }, status: "active" }).select("_id role");
  return Promise.all(users.map((user) => notifyUser(user, { ...values, eventKey: `${values.eventKey}:${user._id}` }, options)));
}

export const notifyAdmins = (values, options) => notifyRoles(["admin", "staff", "owner"], values, options);

function dateBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildFilter(recipientId, params = {}, { omitRead = false, omitAction = false } = {}) {
  const filter = { ...recipientFilter(recipientId) };
  if (!omitRead && (params.isRead === "true" || params.isRead === true)) filter.isRead = true;
  if (!omitRead && (params.isRead === "false" || params.isRead === false)) filter.isRead = false;
  const wantsAction = params.requiresAction === "true" || params.requiresAction === true;
  const wantsInformation = params.requiresAction === "false" || params.requiresAction === false;
  if (params.priority) filter.priority = params.priority;
  if (params.type) filter.type = params.type;

  const conditions = [];
  if (!omitAction && wantsAction) conditions.push({ $or: [{ requiresAction: true }, { requiresAction: { $exists: false }, type: { $in: NOTIFICATION_ACTION_TYPES } }] });
  if (!omitAction && wantsInformation) conditions.push({ $or: [{ requiresAction: false }, { requiresAction: { $exists: false }, type: { $nin: NOTIFICATION_ACTION_TYPES } }] });
  if (params.category || params.subtype) {
    const types = typesForTaxonomy(params.category, params.subtype);
    const taxonomyCondition = [];
    const concreteSubtype = NOTIFICATION_SUBTYPES.includes(params.subtype);
    if (params.category && params.subtype && concreteSubtype) taxonomyCondition.push({ category: params.category, subtype: params.subtype });
    else if (!params.subtype && params.category) taxonomyCondition.push({ category: params.category });
    else if (!params.category && concreteSubtype) taxonomyCondition.push({ subtype: params.subtype });
    if (types.length) taxonomyCondition.push({ type: { $in: types } });
    conditions.push({ $or: taxonomyCondition });
  }
  const from = dateBoundary(params.from);
  const to = dateBoundary(params.to, true);
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const search = String(params.search || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    conditions.push({ $or: [
      { title: regex }, { message: regex }, { content: regex }, { "metadata.orderCode": regex },
      { "metadata.paymentReference": regex }, { "metadata.customerName": regex },
      { "metadata.customerEmail": regex }, { "metadata.customerPhone": regex }
    ] });
  }
  if (conditions.length) filter.$and = conditions;
  return filter;
}

export async function listNotifications(recipientId, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 12));
  const filter = buildFilter(recipientId, params);
  const countBase = buildFilter(recipientId, params, { omitRead: true, omitAction: true });
  const actionCountFilter = {
    ...countBase,
    $and: [...(countBase.$and || []), { $or: [{ requiresAction: true }, { requiresAction: { $exists: false }, type: { $in: NOTIFICATION_ACTION_TYPES } }] }]
  };
  const [total, all, unread, read, requiresAction] = await Promise.all([
    Notification.countDocuments(filter), Notification.countDocuments(countBase),
    Notification.countDocuments({ ...countBase, isRead: false }), Notification.countDocuments({ ...countBase, isRead: true }),
    Notification.countDocuments(actionCountFilter)
  ]);

  let items;
  if (params.sort === "priority") {
    items = await Notification.aggregate([
      { $match: filter },
      { $addFields: { priorityRank: { $indexOfArray: [["low", "normal", "high", "urgent"], "$priority"] } } },
      { $sort: { priorityRank: -1, createdAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { priorityRank: 0 } }
    ]);
  } else {
    const sort = params.sort === "oldest" ? { createdAt: 1 }
      : params.sort === "unread" ? { isRead: 1, createdAt: -1 }
      : params.sort === "action" ? { requiresAction: -1, createdAt: -1 }
      : { createdAt: -1 };
    items = await Notification.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  }
  return {
    items: items.map(serialize),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    counts: { all, unread, read, requiresAction }
  };
}

export async function markAsRead(recipientId, notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) throw new ApiError(400, "Mã thông báo không hợp lệ.");
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, ...recipientFilter(recipientId) },
    { $set: { isRead: true, readAt: new Date() } }, { new: true }
  );
  if (!notification) throw new ApiError(404, "Không tìm thấy thông báo.");
  return serialize(notification);
}

export async function markAllAsRead(recipientId) {
  const result = await Notification.updateMany(
    { ...recipientFilter(recipientId), isRead: false }, { $set: { isRead: true, readAt: new Date() } }
  );
  return { updatedCount: result.modifiedCount, unreadCount: 0 };
}
