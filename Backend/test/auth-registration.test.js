import assert from "node:assert/strict";
import test from "node:test";
import { validationResult } from "express-validator";
import { registerValidation } from "../src/validations/auth.validation.js";

async function validateRegistration(body) {
  const request = { body };
  await Promise.all(registerValidation.map((validation) => validation.run(request)));
  return validationResult(request);
}

const validRegistration = {
  name: "Khách hàng ARA",
  phone: "0901234567",
  password: "secret123",
};

test("registration accepts an omitted or blank email", async () => {
  const omitted = await validateRegistration(validRegistration);
  const blank = await validateRegistration({ ...validRegistration, email: "" });

  assert.equal(omitted.isEmpty(), true);
  assert.equal(blank.isEmpty(), true);
});

test("registration still rejects an invalid email when provided", async () => {
  const result = await validateRegistration({ ...validRegistration, email: "khong-hop-le" });

  assert.equal(result.isEmpty(), false);
  assert.equal(result.array()[0]?.path, "email");
});
