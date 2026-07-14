function currentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem("ara_user") || "null");
    return user?.id || user?._id || null;
  } catch {
    return null;
  }
}

function key(userId = currentUserId()) {
  return userId ? `ara_rental_cart_${userId}` : "ara_guest_rental_cart";
}

function read(userId) {
  const items = JSON.parse(localStorage.getItem(key(userId)) || "[]");

  // Các giỏ được tạo trước đây đã làm rơi thông tin gói 3 ngày 2 đêm.
  // Khôi phục ngày mặc chính từ ngày nhận để checkout không tính thành
  // lịch thuê cũ theo số ngày.
  return items.map((item) => {
    if (item.mainUseDate || Number(item.rentalDays) !== 2) return item;

    const pickupDate = String(item.rentalDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) return item;
    const [year, month, day] = pickupDate.split("-").map(Number);
    const mainUseDate = new Date(Date.UTC(year, month - 1, day + 1))
      .toISOString()
      .slice(0, 10);

    return { ...item, mainUseDate, extraDays: 0 };
  });
}

function write(items, userId) {
  localStorage.setItem(key(userId), JSON.stringify(items));
  window.dispatchEvent(new Event("ara-cart-change"));
  return items;
}

export function getRentalCart(userId) {
  return read(userId);
}

export function addToRentalCart(product, rentalDate, returnDate, userId, options = {}) {
  const id = product.id || product._id;
  const items = read(userId);
  const pickupTime = options.pickupTime || "";
  const returnTime = options.returnTime || "";
  const rentalDays = Number(options.rentalDays || 1);
  const exists = items.some((item) =>
    (item.product.id || item.product._id) === id &&
    item.rentalDate === rentalDate &&
    item.returnDate === returnDate &&
    (item.pickupTime || "") === pickupTime &&
    (item.returnTime || "") === returnTime
  );
  if (exists) return items;
  return write(
    [
      ...items,
      {
        id: `${id}-${rentalDate}-${returnDate}-${pickupTime}-${returnTime}`,
        product,
        rentalDate,
        returnDate,
        pickupTime,
        returnTime,
        rentalDays,
        mainUseDate: options.mainUseDate || "",
        extraDays: Math.max(0, Number(options.extraDays || 0)),
        quote: options.quote || null
      }
    ],
    userId
  );
}

export function removeFromRentalCart(itemId, userId) {
  return write(read(userId).filter((item) => item.id !== itemId), userId);
}

export function clearRentalCart(userId) {
  return write([], userId);
}

export function clearGuestRentalCart() {
  localStorage.removeItem("ara_guest_rental_cart");
}

export function mergeGuestRentalCart(userId = currentUserId()) {
  if (!userId) return [];
  const guestItems = read(null);
  const userItems = read(userId);
  const merged = [...userItems];

  for (const item of guestItems) {
    const exists = merged.some((current) => current.id === item.id);
    if (!exists) merged.push(item);
  }

  write(merged, userId);
  clearGuestRentalCart();
  return merged;
}
