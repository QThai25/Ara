import React from "react";

import { ProductCarousel } from "./ProductCarousel.jsx";

export function ProductSection({
  products,
  loading,
  error,
  onOpen,
  onWishlist,
  isWishlisted
}) {
  return (
    <ProductCarousel
      title="Sản phẩm mới về"
      products={products}
      loading={loading}
      error={error}
      emptyText="Không có sản phẩm phù hợp."
      onOpen={onOpen}
      onWishlist={onWishlist}
      isWishlisted={isWishlisted}
    />
  );
}