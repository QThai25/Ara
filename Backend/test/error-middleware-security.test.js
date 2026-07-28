import test from "node:test";
import assert from "node:assert/strict";
import { errorHandler } from "../src/middlewares/error.middleware.js";

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; }
  };
}

test("500 responses do not expose database errors or internal data", () => {
  const res = response();
  const original = console.error;
  console.error = () => {};
  try {
    errorHandler(
      Object.assign(new Error("MongoServerError: duplicate key secret-token"), { data: { query: "sensitive" } }),
      { method: "POST", originalUrl: "/api/example" },
      res,
      () => {}
    );
  } finally {
    console.error = original;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.message, "Có lỗi hệ thống, vui lòng thử lại sau.");
  assert.equal(res.payload.data, null);
  assert.doesNotMatch(JSON.stringify(res.payload), /MongoServerError|secret-token|sensitive/);
});

test("expected client errors preserve their actionable message", () => {
  const res = response();
  errorHandler(
    Object.assign(new Error("Dữ liệu không hợp lệ."), { statusCode: 400, data: { field: "name" } }),
    { method: "POST", originalUrl: "/api/example" },
    res,
    () => {}
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, "Dữ liệu không hợp lệ.");
  assert.deepEqual(res.payload.data, { field: "name" });
});
