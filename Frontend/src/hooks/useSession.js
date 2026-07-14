import { useState } from "react";
import { logout as logoutRequest } from "../services/authService.js";
import { mergeGuestRentalCart } from "../services/rentalCartService.js";
import { mergeGuestWishlist } from "../services/wishlistService.js";

export function useSession(notify) {
  const [token, setToken] = useState(localStorage.getItem("ara_token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("ara_user") || "null"));

  const saveSession = (data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("ara_token", data.token);
    localStorage.setItem("ara_user", JSON.stringify(data.user));
    const userId = data.user?.id || data.user?._id;
    mergeGuestRentalCart(userId);
    mergeGuestWishlist(userId);
    window.dispatchEvent(new Event("ara-auth-change"));
    window.dispatchEvent(new Event("ara-cart-change"));
    window.dispatchEvent(new Event("ara-wishlist-change"));
  };

  const logout = async () => {
    try {
      if (token) await logoutRequest();
    } catch {
      // Logout local still needs to work when the network is unavailable.
    }
    setToken("");
    setUser(null);
    localStorage.removeItem("ara_token");
    localStorage.removeItem("ara_user");
    window.dispatchEvent(new Event("ara-auth-change"));
    window.dispatchEvent(new Event("ara-cart-change"));
    window.dispatchEvent(new Event("ara-wishlist-change"));
    notify("Đã đăng xuất.", "success");
  };

  return { token, user, saveSession, logout };
}
