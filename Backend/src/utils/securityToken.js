import crypto from "node:crypto";

const secret = () => process.env.PASSWORD_RECOVERY_TOKEN_SECRET || process.env.JWT_SECRET || "dev-password-recovery-secret";

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token, purpose) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${purpose}:${String(token || "")}`)
    .digest("hex");
}
