import test from "node:test";
import assert from "node:assert/strict";
import { createAuthRateLimit, passwordRecoveryRateLimit } from "../src/middlewares/authRateLimit.middleware.js";

function response() {
  return {
    headers: {}, statusCode: 200, payload: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; }
  };
}

test("auth limiter blocks repeated attempts and returns Retry-After", () => {
  const limiter = createAuthRateLimit({ name: `test-${Date.now()}`, limit: 2, windowMs: 60_000 });
  const req = { ip: "127.0.0.10", body: { email: "user@example.com" } };
  let accepted = 0;
  limiter(req, response(), () => { accepted += 1; });
  limiter(req, response(), () => { accepted += 1; });
  const blocked = response();
  limiter(req, blocked, () => { accepted += 1; });
  assert.equal(accepted, 2);
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers["Retry-After"]) > 0);
  assert.equal(blocked.payload.success, false);
});

test("auth limiter scopes attempts by account identity", () => {
  const limiter = createAuthRateLimit({ name: `identity-${Date.now()}`, limit: 1, windowMs: 60_000 });
  let accepted = 0;
  limiter({ ip: "127.0.0.11", body: { email: "one@example.com" } }, response(), () => { accepted += 1; });
  limiter({ ip: "127.0.0.11", body: { email: "two@example.com" } }, response(), () => { accepted += 1; });
  assert.equal(accepted, 2);
});

test("auth limiter protects one account across different IP addresses", () => {
  const limiter = createAuthRateLimit({ name: `account-${Date.now()}`, limit: 1, windowMs: 60_000 });
  let accepted = 0;
  limiter({ ip: "127.0.0.12", body: { email: "same@example.com" } }, response(), () => { accepted += 1; });
  const blocked = response();
  limiter({ ip: "127.0.0.13", body: { email: "same@example.com" } }, blocked, () => { accepted += 1; });
  assert.equal(accepted, 1);
  assert.equal(blocked.statusCode, 429);
});

test("password recovery limiter also scopes attempts to the trusted-device cookie", () => {
  let accepted = 0;
  for (let index = 0; index < 5; index += 1) {
    passwordRecoveryRateLimit({
      ip: `127.0.1.${index}`,
      headers: { cookie: "ara_trusted_device=same-browser-secret" },
      body: { phone: `09012345${String(index).padStart(2, "0")}` }
    }, response(), () => { accepted += 1; });
  }
  const blocked = response();
  passwordRecoveryRateLimit({
    ip: "127.0.1.20",
    headers: { cookie: "ara_trusted_device=same-browser-secret" },
    body: { phone: "0909999999" }
  }, blocked, () => { accepted += 1; });
  assert.equal(accepted, 5);
  assert.equal(blocked.statusCode, 429);
});
