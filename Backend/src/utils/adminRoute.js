function passwordResetGrantMatch(req) {
  const path = req.path || String(req.originalUrl || "").split("?")[0];
  return /\/([^/]+)\/password-reset-grant$/.exec(path);
}

export function isPasswordResetGrantRoute(req) {
  return Boolean(passwordResetGrantMatch(req));
}

export function passwordResetGrantCustomerId(req) {
  return passwordResetGrantMatch(req)?.[1] || "";
}
