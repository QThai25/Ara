import test from "node:test";
import assert from "node:assert/strict";
import { getEmailInvoiceConfig } from "../src/config/gmail.config.js";

const EMAIL_KEYS = [
  "EMAIL_PROVIDER", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER",
  "SMTP_PASSWORD", "SMTP_FROM_NAME", "SMTP_FROM_EMAIL"
];

function withEmailEnv(values, callback) {
  const previous = Object.fromEntries(EMAIL_KEYS.map((key) => [key, process.env[key]]));
  for (const key of EMAIL_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try { callback(); } finally {
    for (const key of EMAIL_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("email delivery is disabled by default", () => {
  withEmailEnv({}, () => {
    const config = getEmailInvoiceConfig();
    assert.equal(config.provider, "disabled");
    assert.equal(config.enabled, false);
    assert.equal(config.configured, false);
    assert.deepEqual(config.configurationErrors, []);
  });
});

test("SMTP validates credentials and accepts complete configuration", () => {
  withEmailEnv({ EMAIL_PROVIDER: "smtp" }, () => {
    const config = getEmailInvoiceConfig();
    assert.equal(config.configured, false);
    assert.ok(config.configurationErrors.includes("SMTP_USER is required."));
    assert.ok(config.configurationErrors.includes("SMTP_PASSWORD is required."));
  });
  withEmailEnv({
    EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465",
    SMTP_SECURE: "true", SMTP_USER: "sender@example.com",
    SMTP_PASSWORD: "app-password", SMTP_FROM_EMAIL: "sender@example.com"
  }, () => {
    const config = getEmailInvoiceConfig();
    assert.equal(config.configured, true);
    assert.equal(config.smtp.secure, true);
    assert.equal(config.smtp.port, 465);
  });
});
