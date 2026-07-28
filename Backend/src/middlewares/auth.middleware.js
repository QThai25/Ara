import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

export async function auth(req, res, next) {
  try {
    if (req.user) return next();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "Vui lòng đăng nhập để tiếp tục.");
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(payload.id).select("-password");
    if (!user) throw new ApiError(401, "Phiên đăng nhập không hợp lệ.");
    if (user.status === "blocked") throw new ApiError(403, "Tài khoản của bạn đang bị khóa.");
    req.user = user;
    next();
  } catch (err) {
    next(err.name === "JsonWebTokenError" ? new ApiError(401, "Phiên đăng nhập không hợp lệ.") : err);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(payload.id).select("-password");
    if (!user || user.status === "blocked") return next();
    req.user = user;
    return next();
  } catch {
    return next();
  }
}
