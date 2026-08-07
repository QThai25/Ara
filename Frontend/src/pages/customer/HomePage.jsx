import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

    getActiveBanners("hero")
      .then((items) => {
        if (!mounted) return;
        setBanners(items);
      })
      .catch(() => {
        if (mounted) setBanners([]);
      })
      .finally(() => {
        if (mounted) setBannersLoading(false);
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
      {!bannersLoading && !loading && (
        <section className="ara-home-seo-intro" aria-labelledby="home-seo-title">
          <div className="ara-home-seo-intro__content">
            <span className="ara-home-seo-intro__eyebrow">ARA DRESS · THUÊ TRANG PHỤC</span>
            <h1 id="home-seo-title">Cho thuê trang phục &amp; váy thiết kế</h1>
            <p>
              Từ váy đi tiệc đến những thiết kế cho buổi chụp ảnh hay dịp đặc biệt, Ara Dress mang đến lựa chọn trang phục thuê phù hợp với từng phong cách.
            </p>
            <Link className="ara-home-seo-intro__link" to={paths.catalog}>
              Khám phá bộ sưu tập
            </Link>
          </div>
        </section>
      )}
      <BenefitSection user={user} notify={notify} />
      <OccasionSection />
      <StyleSection />
      <ProductSection products={products} loading={loading} error={error} onOpen={openProduct} onWishlist={toggle} isWishlisted={(id) => isWishlisted(id, user?.id || user?._id)} />
    </>
  );
}
