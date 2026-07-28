const value = (name, fallback = "") => String(process.env[name] ?? fallback).trim();

function booleanValue(name, fallback) {
  const raw = value(name);
  if (!raw) return fallback;
  if (["true", "1", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["false", "0", "no", "off"].includes(raw.toLowerCase())) return false;
  return null;
}

function resolveProvider() {
  return value("EMAIL_PROVIDER", "disabled").toLowerCase();
}

export function getEmailInvoiceConfig() {
  const provider = resolveProvider();
  const smtpPortRaw = value("SMTP_PORT", "465");
  const smtpPort = Number(smtpPortRaw);
  const smtpSecure = booleanValue("SMTP_SECURE", true);
  const config = {
    provider,
    enabled: provider !== "disabled",
    senderName: value("SMTP_FROM_NAME", "ARA Rental"),
    senderEmail: value("SMTP_FROM_EMAIL"),
    companyName: value("INVOICE_COMPANY_NAME", "ARA Costume Rental"),
    companyAddress: value("INVOICE_COMPANY_ADDRESS"),
    companyPhone: value("INVOICE_COMPANY_PHONE"),
    smtp: {
      host: value("SMTP_HOST", "smtp.gmail.com"),
      port: smtpPort,
      secure: smtpSecure,
      user: value("SMTP_USER"),
      password: value("SMTP_PASSWORD")
    }
  };

  const errors = [];
  if (!["smtp", "disabled"].includes(provider)) {
    errors.push("EMAIL_PROVIDER must be smtp or disabled.");
  } else if (provider === "smtp") {
    if (!config.smtp.host) errors.push("SMTP_HOST is required.");
    if (!Number.isInteger(config.smtp.port) || config.smtp.port < 1 || config.smtp.port > 65535) errors.push("SMTP_PORT must be an integer from 1 to 65535.");
    if (config.smtp.secure === null) errors.push("SMTP_SECURE must be true or false.");
    if (!config.smtp.user) errors.push("SMTP_USER is required.");
    if (!config.smtp.password) errors.push("SMTP_PASSWORD is required.");
    if (!config.senderEmail) errors.push("SMTP_FROM_EMAIL is required.");
  }

  config.configurationErrors = errors;
  config.configured = config.enabled && errors.length === 0;
  return config;
}
