const PASSWORD_RESET_GRANT_METHODS = new Set(["GET", "POST", "DELETE"]);

function passwordResetGrantMatch(req, basePath = "") {
  if (!PASSWORD_RESET_GRANT_METHODS.has(String(req.method || "").toUpperCase())) return null;
  const mountedPath = String(basePath || req.baseUrl || "").split("?")[0].replace(/\/+$/, "");
  if (!/\/admin\/customers$/i.test(mountedPath)) return null;
  const path = req.path || String(req.originalUrl || "").split("?")[0];
  return /^\/([^/]+)\/password-reset-grant\/?$/i.exec(path);
}

export function isPasswordResetGrantRoute(req, basePath = "") {
  return Boolean(passwordResetGrantMatch(req, basePath));
}

export function passwordResetGrantCustomerId(req) {
  return passwordResetGrantMatch(req)?.[1] || "";
}
