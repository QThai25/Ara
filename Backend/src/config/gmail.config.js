export function getGmailInvoiceConfig() {
  const config = {
    enabled: String(process.env.GMAIL_INVOICE_ENABLED || "false").toLowerCase() === "true",
    clientId: String(process.env.GMAIL_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.GMAIL_CLIENT_SECRET || "").trim(),
    refreshToken: String(process.env.GMAIL_REFRESH_TOKEN || "").trim(),
    senderEmail: String(process.env.GMAIL_SENDER_EMAIL || "").trim(),
    senderName: String(process.env.GMAIL_SENDER_NAME || "ARA Costume Rental").trim(),
    companyName: String(process.env.INVOICE_COMPANY_NAME || "ARA Costume Rental").trim(),
    companyAddress: String(process.env.INVOICE_COMPANY_ADDRESS || "").trim(),
    companyPhone: String(process.env.INVOICE_COMPANY_PHONE || "").trim()
  };
  config.configured = Boolean(config.enabled && config.clientId && config.clientSecret && config.refreshToken && config.senderEmail);
  return config;
}
