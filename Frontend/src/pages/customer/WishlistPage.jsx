import React, { useEffect, useState } from "react";
import { ProductCard } from "../../components/customer/ProductCard.jsx";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { getWishlist, removeWishlist } from "../../services/wishlistService.js";
import { paths, views } from "../../routes/views.js";

export function WishlistPage({ user, setView, notify }) {
  const userId = user?.id || user?._id;
  const [items, setItems] = useState(() => getWishlist(userId));

  useEffect(() => {
    setItems(getWishlist(userId));
  }, [userId]);

  const remove = (product) => {
    removeWishlist(product.id || product._id, userId);
    setItems(getWishlist(userId));
    notify("Đã xóa khỏi danh sách yêu thích.");
  };

  return (
    <section className="mei-catalog-page">
      <div className="mei-page-title">
        <h1>Trang phục yêu thích</h1>
        <p>Những mẫu váy bạn đã lưu để xem lại khi cần.</p>
      </div>
      {items.length === 0 && <StateMessage text="Bạn chưa có trang phục yêu thích." />}
      <div className="mei-product-grid mei-catalog-grid">
        {items.map((product, index) => (
          <ProductCard key={product.id || product._id} product={product} index={index} onOpen={(item) => setView(views.detail, paths.detail(item.id || item._id))} onWishlist={remove} wishlisted />
        ))}
      </div>
    </section>
  );
}
