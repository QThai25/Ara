import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Breadcrumb } from "../../components/common/Breadcrumb.jsx";
import { ProductCard } from "../../components/customer/ProductCard.jsx";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { BrandFilterGrid } from "../../components/customer/BrandFilterGrid.jsx";
import { FilterSidebar } from "../../components/customer/FilterSidebar.jsx";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { brandToSlug } from "../../services/brandService.js";
import { getCategories, getCostumes } from "../../services/costumeService.js";
import { isWishlisted, toggleWishlist } from "../../services/wishlistService.js";
import { paths, views } from "../../routes/views.js";
import { canonicalSlug, occasionLabelBySlug, styleLabelBySlug } from "../../utils/catalogData.js";
import { useAriMascot } from "../../context/AriMascotContext.jsx";

const emptyFilters = {
  search: "",
  category: "",
  size: "",
  color: "",
  occasion: "",
  style: "",
  minPrice: "",
  maxPrice: "",
  status: "available"
};

function filtersFromSearchParams(searchParams) {
  return {
    ...emptyFilters,
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || searchParams.get("categorySlug") || searchParams.get("categoryId") || "",
    color: searchParams.get("color") || "",
    occasion: canonicalSlug(searchParams.get("occasion") || ""),
    style: canonicalSlug(searchParams.get("style") || ""),
    size: searchParams.get("size") || "",
    status: searchParams.get("status") || "available",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || ""
  };
}

function buildSearchParams(filters, selectedBrands) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && !(key === "status" && value === "available")) params.set(key, value);
  });
  selectedBrands.forEach((brand) => params.append("brand", brand));
  return params;
}

function sameStringArray(first, second) {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

function productMatchesBrand(product, selectedBrands = []) {
  if (!selectedBrands.length) {
    return true;
  }

  const normalizedSelectedBrands = selectedBrands
    .map((value) => brandToSlug(value))
    .filter(Boolean);

  const productBrandValues = [
    product?.brandSlug,
    product?.brandName,
    product?.brand,
    product?.brandId,
    product?.brandId?.slug,
    product?.brandId?.name
  ]
    .map((value) => brandToSlug(value))
    .filter(Boolean);

  return productBrandValues.some((value) =>
    normalizedSelectedBrands.includes(value)
  );
}

function titleForFilters(filters, selectedBrands, categories) {
  if (filters.occasion) return `Trang phục cho ${occasionLabelBySlug[filters.occasion] || filters.occasion}`;
  if (filters.style) return `Phong cách ${styleLabelBySlug[filters.style] || filters.style}`;
  if (selectedBrands.length) return `Thương hiệu ${selectedBrands[0].replace(/-/g, " ").toUpperCase()}`;
  if (filters.category) {
    const category = categories.find((item) => item.slug === filters.category || item.id === filters.category || item._id === filters.category);
    return `Danh mục ${category?.name || filters.category}`;
  }
  return "Danh mục sản phẩm";
}

export function CostumesPage({ setView, user, notify }) {
  const [, setWishlistVersion] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState(filtersFromSearchParams(searchParams));
  const [selectedBrands, setSelectedBrands] = useState(searchParams.getAll("brand").map(brandToSlug).filter(Boolean));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(filters.search, 600);
  const requestRef = useRef(0);
  const externalQueryRef = useRef(null);
  const {
    showProductReaction,
    celebrateProduct,
    celebrateAri,
    clearReaction
  } = useAriMascot();

  useEffect(() => {
    const incomingQuery = searchParams.toString();
    const stateQuery = buildSearchParams(filters, selectedBrands).toString();
    if (incomingQuery === stateQuery) return;
    externalQueryRef.current = incomingQuery;
    const nextFilters = filtersFromSearchParams(searchParams);
    const nextBrands = searchParams.getAll("brand").map(brandToSlug).filter(Boolean);
    setFilters((current) => JSON.stringify(current) === JSON.stringify(nextFilters) ? current : nextFilters);
    setSelectedBrands((current) => sameStringArray(current, nextBrands) ? current : nextBrands);
  }, [searchParams]);

  const query = useMemo(() => {
    const backendFilters = {
      search: debouncedSearch,
      category: filters.category,
      size: filters.size === "Freesize" ? "" : filters.size,
      color: filters.color,
      occasion: filters.occasion,
      style: filters.style,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      status: filters.status,
      brand: selectedBrands.join(",")
    };
    const params = new URLSearchParams(Object.entries(backendFilters).filter(([, value]) => value));
    return params.toString() ? `?${params}` : "";
  }, [filters, debouncedSearch, selectedBrands]);

  useEffect(() => {
    const params = buildSearchParams(filters, selectedBrands);
    const nextQuery = params.toString();
    if (externalQueryRef.current !== null) {
      if (nextQuery === externalQueryRef.current) externalQueryRef.current = null;
      return;
    }
    if (nextQuery !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [filters, selectedBrands, searchParams, setSearchParams]);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    const load = async () => {
      setLoading((current) => (products.length ? current : true));
      setError("");
      try {
        const [items, cats] = await Promise.all([getCostumes(query, { signal: controller.signal }), getCategories()]);
        if (requestRef.current !== requestId) return;
        setProducts(items.filter((item) => productMatchesBrand(item, selectedBrands)));
        setCategories(cats);
      } catch (err) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setError(err.message);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [query, selectedBrands]);

  const filterTitle = titleForFilters(filters, selectedBrands, categories);
  const hasActiveFilters = searchParams.toString().length > 0;
  const openProduct = (product) => setView(views.detail, paths.detail(product.id || product._id));
  const clearAllFilters = () => {
    setFilters(emptyFilters);
    setSelectedBrands([]);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const wishlist = (product) => {
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
      <Breadcrumb current={filterTitle} setView={setView} />
      <section className="catalog-two-column">
        <button className="filter-toggle" onClick={() => setDrawerOpen(true)}><Filter size={18} /> Bộ lọc sản phẩm</button>
        <div className="catalog-search-row">
          <div className="catalog-title-block">
            <h1>{filterTitle}</h1>
            {hasActiveFilters && <button type="button" onClick={clearAllFilters}>Xóa bộ lọc</button>}
          </div>
          <label><Search size={16} /> Tìm sản phẩm<input placeholder="Tên sản phẩm..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        </div>
        <div className="catalog-layout">
          <div className="desktop-sidebar">
            <FilterSidebar filters={filters} setFilters={setFilters} categories={categories} onClear={clearAllFilters} />
          </div>
          <main className="catalog-content">
            <BrandFilterGrid selectedBrands={selectedBrands} setSelectedBrands={(next) => {
              const value = typeof next === "function" ? next(selectedBrands) : next;
              if (!sameStringArray(value, selectedBrands)) setSelectedBrands(value);
            }} />
            {loading && <StateMessage text="Đang tải sản phẩm..." />}
            {error && <StateMessage text={error} tone="error" />}
            {!loading && !error && products.length === 0 && <StateMessage text="Chưa có trang phục phù hợp với bộ lọc này." />}
            <div className="mei-product-grid mei-catalog-grid">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id || product._id}
                  product={product}
                  index={index}
                  onOpen={openProduct}
                  onWishlist={wishlist}
                  wishlisted={isWishlisted(product.id || product._id, user?.id || user?._id)}
                  onMouseEnter={() => showProductReaction(product)}
                  onMouseLeave={clearReaction}
                  onFocus={() => showProductReaction(product)}
                  onBlur={clearReaction}
                  onTouchStart={() => showProductReaction(product)}
                  onOpenFeedback={() => celebrateProduct(product)}
                  onWishlistFeedback={() => {
                    celebrateAri(
                      user
                        ? "Ari đã ghi nhớ món bạn thích rồi nè ✨"
                        : "Đăng nhập để Ari giữ danh sách yêu thích cho bạn nha!"
                    );
                  }}
                />
              ))}
            </div>
          </main>
        </div>
      </section>
      <aside className={`filter-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="filter-drawer-head">
          <strong>Bộ lọc sản phẩm</strong>
          <button onClick={() => setDrawerOpen(false)}><X size={20} /></button>
        </div>
        <FilterSidebar filters={filters} setFilters={setFilters} categories={categories} onClear={clearAllFilters} />
      </aside>
    </>
  );
}
