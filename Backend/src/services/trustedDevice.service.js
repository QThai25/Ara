import { TrustedDevice } from "../models/TrustedDevice.js";
import { createOpaqueToken, hashOpaqueToken } from "../utils/securityToken.js";

export const TRUSTED_DEVICE_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;
export const TRUSTED_DEVICE_LIMIT = 3;

const expiresFrom = (now) => new Date(now.getTime() + TRUSTED_DEVICE_LIFETIME_MS);
const tokenHash = (token) => hashOpaqueToken(token, "trusted-device");

async function revokeDevicesBeyondLimit(userId, now) {
  const devices = await TrustedDevice.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: now }
  }).sort({ lastUsedAt: -1, createdAt: -1 }).select("_id").lean();
  const revokeIds = devices.slice(TRUSTED_DEVICE_LIMIT).map((device) => device._id);
  if (revokeIds.length) {
    await TrustedDevice.updateMany(
      { _id: { $in: revokeIds }, revokedAt: null },
      { $set: { revokedAt: now } }
    );
  }
}

export async function establishTrustedDevice({ userId, currentToken = "" }) {
  const now = new Date();
  const nextToken = createOpaqueToken();
  const update = {
    tokenHash: tokenHash(nextToken),
    lastUsedAt: now,
    expiresAt: expiresFrom(now)
  };

  let device = null;
  if (currentToken) {
    device = await TrustedDevice.findOneAndUpdate({
      userId,
      tokenHash: tokenHash(currentToken),
      revokedAt: null,
      expiresAt: { $gt: now }
    }, { $set: update }, { new: true });
  }

  if (!device) {
    device = await TrustedDevice.create({
      userId,
      ...update,
      label: "Trình duyệt đã tin cậy"
    });
  }

  await revokeDevicesBeyondLimit(userId, now);
  return { token: nextToken, deviceId: device._id, expiresAt: update.expiresAt };
}

export function findValidTrustedDevice({ userId, token }) {
  if (!token) return null;
  return TrustedDevice.findOne({
    userId,
    tokenHash: tokenHash(token),
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }).select("_id userId expiresAt");
}

export async function rotateTrustedDeviceById({ userId, deviceId }) {
  if (!deviceId) return null;
  const now = new Date();
  const nextToken = createOpaqueToken();
  const device = await TrustedDevice.findOneAndUpdate({
    _id: deviceId,
    userId,
    revokedAt: null,
    expiresAt: { $gt: now }
  }, {
    $set: {
      tokenHash: tokenHash(nextToken),
      lastUsedAt: now,
      expiresAt: expiresFrom(now)
    }
  }, { new: true });
  return device ? { token: nextToken, deviceId: device._id, expiresAt: device.expiresAt } : null;
}
