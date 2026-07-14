function currentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem("ara_user") || "null");
    return user?.id || user?._id || null;
  } catch {
    return null;
  }
}

function key(userId = currentUserId()) {
  return userId ? `ara_wishlist_${userId}` : "ara_wishlist_guest";
}

function read(userId) {
  return JSON.parse(localStorage.getItem(key(userId)) || "[]");
}

function write(items, userId) {
  localStorage.setItem(key(userId), JSON.stringify(items));
  window.dispatchEvent(new Event("ara-wishlist-change"));
  return items;
}

export function getWishlist(userId) {
  return read(userId);
}

export function isWishlisted(costumeId, userId) {
  return read(userId).some((item) => item.id === costumeId || item._id === costumeId);
}

export function toggleWishlist(product, userId) {
  const id = product.id || product._id;
  const items = read(userId);
  const exists = items.some((item) => (item.id || item._id) === id);
  if (exists) return write(items.filter((item) => (item.id || item._id) !== id), userId);
  return write([...items, product], userId);
}

export function removeWishlist(costumeId, userId) {
  return write(read(userId).filter((item) => (item.id || item._id) !== costumeId), userId);
}

export function clearGuestWishlist() {
  localStorage.removeItem("ara_wishlist_guest");
}

export function mergeGuestWishlist(userId = currentUserId()) {
  if (!userId) return [];
  const guestItems = read(null);
  const userItems = read(userId);
  const merged = [...userItems];

  for (const item of guestItems) {
    const id = item.id || item._id;
    const exists = merged.some((current) => (current.id || current._id) === id);
    if (!exists) merged.push(item);
  }

  write(merged, userId);
  clearGuestWishlist();
  return merged;
}
