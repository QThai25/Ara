import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BenefitSection } from "../../components/customer/BenefitSection.jsx";
import { HeroSection, HeroSectionSkeleton } from "../../components/customer/HeroSection.jsx";
import { OccasionSection } from "../../components/customer/OccasionSection.jsx";
import { ProductSection } from "../../components/customer/ProductSection.jsx";
import { StyleSection } from "../../components/customer/StyleSection.jsx";
import { useProducts } from "../../hooks/useProducts.js";
import { paths, views } from "../../routes/views.js";
import { getActiveBanners } from "../../services/bannerService.js";
import { getCategories } from "../../services/costumeService.js";
import { isWishlisted, toggleWishlist } from "../../services/wishlistService.js";

export function HomePage({ setView, user, notify }) {
  const { products, loading, error } = useProducts("");
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [categories, setCategories] = useState([]);
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

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((items) => {
        if (mounted) setCategories((Array.isArray(items) ? items : []).filter((item) => item?.status === "active" && item?.slug));
      })
      .catch(() => {
        if (mounted) setCategories([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const collectionLinks = useMemo(() => categories.slice(0, 8), [categories]);

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
      <ProductSection products={products} loading={loading} error={error} onOpen={openProduct} onWishlist={toggle} isWishlisted={(id) => isWishlisted(id, user?.id || user?._id)} />
      <section className="ara-home-seo-intro" aria-labelledby="home-seo-title">
          <div className="ara-home-seo-intro__content">
            <span className="ara-home-seo-intro__eyebrow">ARA DRESS · THUÊ TRANG PHỤC</span>
            <h1 id="home-seo-title">Cho thuê trang phục &amp; váy thiết kế</h1>
            <p>
              Ara Dress chuyên cho thuê trang phục nữ, váy thiết kế và váy dự tiệc với giá thuê hợp lý. Xem size, lịch trống và đặt thuê online cho tiệc, chụp ảnh, sự kiện.
            </p>
            <nav className="ara-home-collection-links" aria-label="Bộ sưu tập trang phục">
              <Link className="ara-home-seo-intro__link" to={paths.catalog}>Xem tất cả trang phục cho thuê</Link>
              {collectionLinks.map((category) => (
                <Link key={category.slug} className="ara-home-seo-intro__link" to={paths.category(category.slug)}>
                  Thuê {category.name}
                </Link>
              ))}
            </nav>
          </div>
        </section>
      <BenefitSection user={user} notify={notify} />
      <OccasionSection />
      <StyleSection />
    </>
  );
}
