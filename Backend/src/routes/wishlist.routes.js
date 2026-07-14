import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const wishlistRoutes = Router();

const wishlists = new Map();

function getItems(userId) {
  return wishlists.get(String(userId)) || [];
}

wishlistRoutes.get("/", auth, (req, res) => {
  sendSuccess(res, "Lấy danh sách yêu thích thành công.", getItems(req.user._id));
});

wishlistRoutes.post("/:costumeId", auth, (req, res) => {
  const userId = String(req.user._id);
  const items = new Set(getItems(userId));
  items.add(req.params.costumeId);
  const next = [...items];
  wishlists.set(userId, next);
  sendSuccess(res, "Đã thêm vào danh sách yêu thích.", next, 201);
});

wishlistRoutes.delete("/:costumeId", auth, (req, res) => {
  const userId = String(req.user._id);
  const next = getItems(userId).filter((id) => id !== req.params.costumeId);
  wishlists.set(userId, next);
  sendSuccess(res, "Đã xóa khỏi danh sách yêu thích.", next);
});
