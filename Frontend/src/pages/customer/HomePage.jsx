import React, { useEffect, useState } from "react";
import { BenefitSection } from "../../components/customer/BenefitSection.jsx";
import { HeroSection, HeroSectionSkeleton } from "../../components/customer/HeroSection.jsx";
import { OccasionSection } from "../../components/customer/OccasionSection.jsx";
import { ProductSection } from "../../components/customer/ProductSection.jsx";
import { StyleSection } from "../../components/customer/StyleSection.jsx";
import { useProducts } from "../../hooks/useProducts.js";
import { paths, views } from "../../routes/views.js";
import { getActiveBanners } from "../../services/bannerService.js";
import { isWishlisted, toggleWishlist } from "../../services/wishlistService.js";

export function HomePage({ setView, user, notify }) {
  const { products, loading, error } = useProducts("");
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [, setWishlistVersion] = useState(0);

  useEffect(() => {
    let mounted = true;

    getActiveBanners("hero").then((items) => {
      if (!mounted) return;
      setBanners(items);
      setBannersLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const openProduct = (product) => {
    const id = product.id || product._id;
    setView(views.detail, paths.detail(id));
  };

  const toggle = (product) => {
    if (false && !user) {
      notify("Vui lòng đăng nhập để thêm trang phục yêu thích.", "error");
      setView(views.login, paths.login);
      return;
    }
    toggleWishlist(product, user?.id || user?._id);
    setWishlistVersion((value) => value + 1);
    notify("Đã cập nhật danh sách yêu thích.");
  };

  return (
    <>
      {bannersLoading ? <HeroSectionSkeleton /> : <HeroSection products={products} banners={banners} setView={setView} />}
      <BenefitSection user={user} notify={notify} />
      <OccasionSection />
      <StyleSection />
      <ProductSection products={products} loading={loading} error={error} onOpen={openProduct} onWishlist={toggle} isWishlisted={(id) => isWishlisted(id, user?.id || user?._id)} />
    </>
  );
}
