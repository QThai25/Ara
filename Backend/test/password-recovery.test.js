import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";
import { AuditLog } from "../src/models/AuditLog.js";
import { PasswordResetGrant } from "../src/models/PasswordResetGrant.js";
import { PasswordResetTicket } from "../src/models/PasswordResetTicket.js";
import { TrustedDevice } from "../src/models/TrustedDevice.js";
import { User } from "../src/models/User.js";
import {
  getPasswordResetGrant,
  grantPasswordReset,
  revokePasswordResetGrant
} from "../src/services/passwordResetGrant.service.js";
import { requestPasswordReset, resetPassword } from "../src/services/passwordRecovery.service.js";
import { establishTrustedDevice } from "../src/services/trustedDevice.service.js";
import { createOpaqueToken, hashOpaqueToken } from "../src/utils/securityToken.js";
import { requestPasswordResetValidation, resetPasswordValidation } from "../src/validations/auth.validation.js";

async function validate(rules, body) {
  const request = { body };
  for (const rule of rules) await rule.run(request);
  return validationResult(request);
}

function selected(value) {
  return {
    sort() { return this; },
    select() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

const customer = (overrides = {}) => ({
  _id: "507f191e810c19729de860ea",
  name: "Khách ARA",
  role: "customer",
  status: "active",
  password: "hash",
  ...overrides
});

test("recovery validates a Vietnam phone and matching 8-128 character passwords without accepting a client token", async () => {
  assert.equal((await validate(requestPasswordResetValidation, { phone: "+84 901 234 567" })).isEmpty(), true);
  assert.equal((await validate(requestPasswordResetValidation, { phone: "123" })).isEmpty(), false);
  assert.equal((await validate(resetPasswordValidation, {
    newPassword: "new-secret-123",
    confirmPassword: "new-secret-123"
  })).isEmpty(), true);
  assert.equal((await validate(resetPasswordValidation, {
    newPassword: "new-secret-123",
    confirmPassword: "different-secret"
  })).isEmpty(), false);
  assert.equal((await validate(resetPasswordValidation, {
    resetToken: "must-not-be-used",
    newPassword: "short",
    confirmPassword: "short"
  })).isEmpty(), false);
});

test("opaque credentials use randomBytes and purpose-separated HMAC hashes", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.notEqual(hashOpaqueToken(first, "trusted-device"), first);
  assert.notEqual(hashOpaqueToken(first, "trusted-device"), hashOpaqueToken(first, "password-reset-ticket"));
});

test("a valid trusted device issues a five-minute ticket but stores only its hash", async (t) => {
  const user = customer();
  let trustedFilter;
  let ticketUpdate;
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(TrustedDevice, "findOne", (filter) => {
    trustedFilter = filter;
    return selected({ _id: "507f1f77bcf86cd799439011", userId: user._id, expiresAt: new Date(Date.now() + 60_000) });
  });
  t.mock.method(PasswordResetTicket, "findOneAndUpdate", async (_filter, update) => {
    ticketUpdate = update.$set;
    return ticketUpdate;
  });

  const result = await requestPasswordReset({ phone: "0901234567", trustedDeviceToken: "browser-secret" });
  assert.equal(result.authorization, "trusted_device");
  assert.equal(result.expiresInSeconds, 300);
  assert.equal(trustedFilter.userId, user._id);
  assert.equal(trustedFilter.revokedAt, null);
  assert.ok(trustedFilter.expiresAt.$gt instanceof Date);
  assert.notEqual(ticketUpdate.tokenHash, result.resetTicket);
  assert.equal(ticketUpdate.authorizationType, "trusted_device");
});

test("a fake, expired, revoked, deleted or other-account trusted cookie cannot authorize recovery", async (t) => {
  const user = customer();
  const filters = [];
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(TrustedDevice, "findOne", (filter) => {
    filters.push(filter);
    return selected(null);
  });
  t.mock.method(PasswordResetGrant, "findById", async () => null);

  for (const token of ["fake-cookie", "changed-cookie", "expired-cookie", "revoked-cookie", ""]) {
    await assert.rejects(
      requestPasswordReset({ phone: "0901234567", trustedDeviceToken: token }),
      (error) => error.statusCode === 403
    );
  }
  assert.ok(filters.every((filter) => filter.userId === user._id));
  assert.ok(filters.every((filter) => filter.revokedAt === null && filter.expiresAt.$gt instanceof Date));
});

test("an active staff grant authorizes recovery when no trusted-device cookie exists", async (t) => {
  const user = customer();
  const grant = {
    _id: user._id,
    userId: user._id,
    status: "active",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    revokedAt: null
  };
  let ticketUpdate;
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(PasswordResetGrant, "findById", async () => grant);
  t.mock.method(PasswordResetTicket, "findOneAndUpdate", async (_filter, update) => {
    ticketUpdate = update.$set;
    return ticketUpdate;
  });

  const result = await requestPasswordReset({ phone: "0901234567" });
  assert.equal(result.authorization, "staff_grant");
  assert.equal(ticketUpdate.grantId, grant._id);
  assert.equal(ticketUpdate.trustedDeviceId, null);
});

test("owner or active staff creates one 15-minute grant and a double click reuses it", async (t) => {
  const user = customer();
  const actor = { _id: "507f191e810c19729de860eb", name: "Nhân viên A", role: "staff", status: "active" };
  let record = null;
  let writes = 0;
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(PasswordResetGrant, "findById", async () => record);
  t.mock.method(PasswordResetGrant, "findOneAndUpdate", async (_filter, update) => {
    writes += 1;
    record = { _id: user._id, ...update.$set };
    return record;
  });
  t.mock.method(AuditLog, "create", async (entry) => entry);

  const first = await grantPasswordReset(user._id, actor);
  const second = await grantPasswordReset(user._id, actor);
  assert.equal(first.status, "active");
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(writes, 1);
  assert.ok(new Date(first.expiresAt).getTime() - new Date(first.createdAt).getTime() <= 15 * 60 * 1000);
});

test("inactive staff and non-customer targets are rejected and audited", async (t) => {
  const audit = [];
  t.mock.method(AuditLog, "create", async (entry) => { audit.push(entry); return entry; });
  await assert.rejects(
    grantPasswordReset("507f191e810c19729de860ea", { _id: "507f191e810c19729de860eb", role: "staff", status: "blocked" }),
    (error) => error.statusCode === 403
  );
  t.mock.method(User, "findOne", () => selected(null));
  await assert.rejects(
    grantPasswordReset("507f191e810c19729de860ec", { _id: "507f191e810c19729de860eb", role: "staff", status: "active" }),
    (error) => error.statusCode === 404
  );
  assert.equal(audit.length, 2);
  assert.ok(audit.every((entry) => entry.action === "password_reset_grant_rejected"));
  assert.ok(audit.every((entry) => entry.result === "rejected"));
});

test("an expired grant is marked expired once and an active grant can be revoked", async (t) => {
  const user = customer();
  const actor = { _id: "507f191e810c19729de860eb", name: "Chủ tiệm", role: "owner", status: "active" };
  const expiredGrant = {
    _id: user._id,
    userId: user._id,
    customerName: user.name,
    createdBy: actor._id,
    createdByName: actor.name,
    createdByRole: "owner",
    status: "active",
    expiresAt: new Date(Date.now() - 1_000)
  };
  const audit = [];
  let current = expiredGrant;
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(PasswordResetGrant, "findById", async () => current);
  t.mock.method(PasswordResetGrant, "findOneAndUpdate", async (_filter, update) => {
    current = { ...current, ...update.$set };
    return current;
  });
  t.mock.method(AuditLog, "create", async (entry) => { audit.push(entry); return entry; });

  const expired = await getPasswordResetGrant(user._id, actor);
  assert.equal(expired.status, "expired");
  assert.equal(audit[0].action, "password_reset_expired");

  current = { ...expiredGrant, status: "active", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, usedAt: null };
  const revoked = await revokePasswordResetGrant(user._id, actor);
  assert.equal(revoked.status, "revoked");
  assert.equal(audit.at(-1).action, "password_reset_revoked");
});

test("an expired reset ticket is rejected before password or grant mutation", async (t) => {
  let ticketFilter;
  let userWrites = 0;
  t.mock.method(PasswordResetTicket, "findOne", (filter) => {
    ticketFilter = filter;
    return selected(null);
  });
  t.mock.method(User, "findOneAndUpdate", () => { userWrites += 1; return selected(null); });
  await assert.rejects(
    resetPassword({ resetTicket: "expired-ticket", newPassword: "new-secret-123" }),
    (error) => error.statusCode === 401
  );
  assert.ok(ticketFilter.expiresAt.$gt instanceof Date);
  assert.equal(ticketFilter.consumedAt, null);
  assert.equal(ticketFilter.revokedAt, null);
  assert.equal(userWrites, 0);
});

test("invalid, expired and revoked tickets are rejected without an atomic consume", async (t) => {
  let consumes = 0;
  t.mock.method(PasswordResetTicket, "findOne", () => selected(null));
  t.mock.method(PasswordResetTicket, "findOneAndUpdate", () => {
    consumes += 1;
    return selected(null);
  });

  for (const resetTicket of ["invalid-ticket", "expired-ticket", "revoked-ticket"]) {
    await assert.rejects(
      resetPassword({ resetTicket, newPassword: "new-secret-123" }),
      (error) => error.statusCode === 401
    );
  }
  assert.equal(consumes, 0);
});

test("same-password rejection keeps the ticket reusable, then success consumes it once", async (t) => {
  const oldPassword = await bcrypt.hash("old-secret-123", 4);
  const user = customer({ password: oldPassword, tokenVersion: 1 });
  const ticket = { userId: user._id, authorizationType: "trusted_device", trustedDeviceId: null, grantId: null };
  let consumed = false;
  let consumeCalls = 0;
  let passwordUpdate;
  t.mock.method(PasswordResetTicket, "findOne", () => selected(consumed ? null : ticket));
  t.mock.method(PasswordResetTicket, "findOneAndUpdate", () => {
    consumed = true;
    consumeCalls += 1;
    return selected(ticket);
  });
  t.mock.method(PasswordResetTicket, "updateMany", async () => ({}));
  t.mock.method(PasswordResetGrant, "updateMany", async () => ({}));
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(User, "findOneAndUpdate", (_filter, update) => {
    passwordUpdate = update;
    return selected({ ...user, password: update.$set.password, tokenVersion: 2 });
  });
  t.mock.method(AuditLog, "create", async (entry) => entry);

  await assert.rejects(
    resetPassword({ resetTicket: "same-password-ticket", newPassword: "old-secret-123" }),
    (error) => error.statusCode === 400
  );
  assert.equal(consumed, false);
  assert.equal(consumeCalls, 0);

  const result = await resetPassword({ resetTicket: "same-password-ticket", newPassword: "new-secret-123" });
  assert.equal(result.sessionsRevoked, true);
  assert.equal(consumed, true);
  assert.equal(consumeCalls, 1);
  assert.deepEqual(passwordUpdate.$inc, { tokenVersion: 1 });

  await assert.rejects(
    resetPassword({ resetTicket: "same-password-ticket", newPassword: "another-secret-123" }),
    (error) => error.statusCode === 401
  );
  assert.equal(consumeCalls, 1);
});

test("a staff grant is consumed once only after the customer submits a valid new password", async (t) => {
  const oldPassword = await bcrypt.hash("old-secret-123", 4);
  const user = customer({ password: oldPassword, tokenVersion: 1 });
  const ticket = { userId: user._id, authorizationType: "staff_grant", grantId: user._id };
  const grant = {
    _id: user._id,
    userId: user._id,
    customerName: user.name,
    createdBy: "507f191e810c19729de860eb",
    createdByName: "Nhân viên A",
    createdByRole: "staff",
    expiresAt: new Date(Date.now() + 60_000),
    status: "active",
    usedAt: null,
    revokedAt: null
  };
  const consumedGrant = { ...grant, status: "used", usedAt: new Date() };
  const audit = [];
  let ticketConsumes = 0;
  t.mock.method(PasswordResetTicket, "findOne", () => selected(ticket));
  t.mock.method(PasswordResetTicket, "findOneAndUpdate", () => {
    ticketConsumes += 1;
    return selected(ticket);
  });
  t.mock.method(PasswordResetTicket, "updateMany", async () => ({}));
  t.mock.method(PasswordResetGrant, "findById", async () => grant);
  t.mock.method(PasswordResetGrant, "findOneAndUpdate", async () => consumedGrant);
  t.mock.method(PasswordResetGrant, "updateMany", async () => ({}));
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(User, "findOneAndUpdate", () => selected({ ...user, tokenVersion: 2 }));
  t.mock.method(AuditLog, "create", async (entry) => { audit.push(entry); return entry; });

  const result = await resetPassword({ resetTicket: "staff-ticket", newPassword: "new-secret-123" });
  assert.equal(result.sessionsRevoked, true);
  assert.equal(result.trustedDeviceToken, "");
  assert.equal(ticketConsumes, 1);
  assert.ok(audit.some((entry) => entry.action === "password_reset_used"));
  assert.ok(audit.every((entry) => !JSON.stringify(entry).includes("new-secret-123")));
});

test("only one concurrent reset can atomically consume a ticket and revoke old sessions", async (t) => {
  const oldPassword = await bcrypt.hash("old-secret-123", 4);
  const user = customer({ password: oldPassword, tokenVersion: 2 });
  const deviceId = "507f1f77bcf86cd799439011";
  const ticket = {
    userId: user._id,
    authorizationType: "trusted_device",
    trustedDeviceId: deviceId,
    grantId: null
  };
  let claimed = false;
  let passwordUpdates = 0;
  let ticketReads = 0;
  let passwordUpdate;
  t.mock.method(PasswordResetTicket, "findOne", () => {
    ticketReads += 1;
    return selected(ticket);
  });
  t.mock.method(PasswordResetTicket, "findOneAndUpdate", () => selected(claimed ? null : (claimed = true, ticket)));
  t.mock.method(PasswordResetTicket, "updateMany", async () => ({}));
  t.mock.method(PasswordResetGrant, "updateMany", async () => ({}));
  t.mock.method(User, "findOne", () => selected(user));
  t.mock.method(User, "findOneAndUpdate", (_filter, update) => {
    passwordUpdates += 1;
    passwordUpdate = update;
    return selected({ ...user, password: update.$set.password, tokenVersion: 3 });
  });
  t.mock.method(TrustedDevice, "findOneAndUpdate", async (_filter, update) => ({ _id: deviceId, ...update.$set }));
  t.mock.method(AuditLog, "create", async (entry) => entry);

  const results = await Promise.allSettled([
    resetPassword({ resetTicket: "one-time-ticket", newPassword: "new-secret-123" }),
    resetPassword({ resetTicket: "one-time-ticket", newPassword: "new-secret-123" })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(ticketReads, 2);
  assert.equal(passwordUpdates, 1);
  const success = results.find((result) => result.status === "fulfilled").value;
  assert.equal(success.sessionsRevoked, true);
  assert.ok(success.trustedDeviceToken);
  assert.deepEqual(passwordUpdate.$inc, { tokenVersion: 1 });
});

test("trusted-device login rotates an existing token and revokes profiles beyond the three-device limit", async (t) => {
  const userId = "507f191e810c19729de860ea";
  const oldHash = hashOpaqueToken("old-browser-token", "trusted-device");
  let rotationFilter;
  let createdHash;
  let revokedIds = [];
  t.mock.method(TrustedDevice, "findOneAndUpdate", async (filter, update) => {
    rotationFilter = filter;
    return { _id: "device-current", expiresAt: update.$set.expiresAt };
  });
  t.mock.method(TrustedDevice, "create", async (values) => { createdHash = values.tokenHash; return { _id: "new-device" }; });
  t.mock.method(TrustedDevice, "find", () => selected([
    { _id: "device-current" }, { _id: "device-2" }, { _id: "device-3" }, { _id: "device-oldest" }
  ]));
  t.mock.method(TrustedDevice, "updateMany", async (filter) => { revokedIds = filter._id.$in; return {}; });

  const rotated = await establishTrustedDevice({ userId, currentToken: "old-browser-token" });
  assert.equal(rotationFilter.tokenHash, oldHash);
  assert.notEqual(hashOpaqueToken(rotated.token, "trusted-device"), oldHash);
  assert.equal(createdHash, undefined);
  assert.deepEqual(revokedIds, ["device-oldest"]);
});

test("recovery contracts keep secrets out of URLs, storage, logs and admin profile editing", async () => {
  const [controller, routes, cookies, audit, customerPage, customerService, recoveryPage, frontendApi] = await Promise.all([
    readFile(new URL("../src/controllers/auth.controller.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/auth.routes.js", import.meta.url), "utf8"),
    readFile(new URL("../src/utils/authCookies.js", import.meta.url), "utf8"),
    readFile(new URL("../src/services/auditLog.service.js", import.meta.url), "utf8"),
    readFile(new URL("../../AdminFrontend/src/pages/AdminCustomerPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/services/customer.service.js", import.meta.url), "utf8"),
    readFile(new URL("../../Frontend/src/pages/customer/ForgotPasswordPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../Frontend/src/services/api.js", import.meta.url), "utf8")
  ]);
  assert.match(cookies, /httpOnly:\s*true/);
  assert.match(cookies, /180 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(controller, /setResetTicketCookie\(res, resetTicket\)/);
  assert.doesNotMatch(controller, /sendSuccess\([^;]*resetTicket/s);
  assert.doesNotMatch(routes, /password\/verify/);
  assert.match(audit, /password\|token\|secret\|cookie/);
  const updateCustomerSource = /export async function updateCustomer[\s\S]*?(?=export async function setCustomerStatus)/.exec(customerService)?.[0] || "";
  assert.doesNotMatch(updateCustomerSource, /payload\.password|bcrypt\.hash/);
  assert.match(customerPage, /!initial && <div className="admin-customer-password-field">/);
  assert.match(customerPage, /grantCustomerPasswordReset\(idOf\(resetCustomer\)\)/);
  assert.doesNotMatch(recoveryPage, /\botp\b|resetToken|localStorage|sessionStorage|mã xác minh/i);
  assert.match(frontendApi, /withCredentials:\s*true/);
});
