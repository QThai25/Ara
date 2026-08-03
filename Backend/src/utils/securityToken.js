import crypto from "node:crypto";

const secret = () => {
  const configured = process.env.PASSWORD_RECOVERY_TOKEN_SECRET || process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "dev-password-recovery-secret";
  throw new Error("PASSWORD_RECOVERY_TOKEN_SECRET or JWT_SECRET must be configured in production.");
};

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token, purpose) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${purpose}:${String(token || "")}`)
    .digest("hex");
}
