const PASSWORD_RESET_GRANT_METHODS = new Set(["GET", "POST", "DELETE"]);

function passwordResetGrantMatch(req, basePath = "") {
  if (!PASSWORD_RESET_GRANT_METHODS.has(String(req.method || "").toUpperCase())) return null;
  const mountedPath = String(basePath || req.baseUrl || "").split("?")[0].replace(/\/+$/, "");
  if (!/\/admin\/customers$/i.test(mountedPath)) return null;
  const originalPath = String(req.originalUrl || "").split("?")[0];
  const mountedIndex = mountedPath ? originalPath.toLowerCase().lastIndexOf(mountedPath.toLowerCase()) : -1;
  const path = req.path || (mountedIndex >= 0 ? originalPath.slice(mountedIndex + mountedPath.length) || "/" : originalPath);
  return /^\/([^/]+)\/password-reset-grant\/?$/i.exec(path);
}

export function isPasswordResetGrantRoute(req, basePath = "") {
  return Boolean(passwordResetGrantMatch(req, basePath));
}

export function passwordResetGrantCustomerId(req) {
  return passwordResetGrantMatch(req)?.[1] || "";
}
