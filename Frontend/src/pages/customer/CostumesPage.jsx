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
import { getCategories, getCostumePage } from "../../services/costumeService.js";
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
  status: "available",
  sort: ""
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
    maxPrice: searchParams.get("maxPrice") || "",
    sort: searchParams.get("sort") === "newest" ? "newest" : ""
  };
}

const CATALOG_PAGE_SIZE = 24;

function pageFromSearchParams(searchParams) {
  const parsed = Number.parseInt(searchParams.get("page"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildSearchParams(filters, selectedBrands, page = 1) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && !(key === "status" && value === "available")) params.set(key, value);
  });
  selectedBrands.forEach((brand) => params.append("brand", brand));
  if (page > 1) params.set("page", String(page));
  return params;
}

function sameStringArray(first, second) {
  return first.length === second.length && first.every((item, index) => item === second[index]);
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
  const [reloadKey, setReloadKey] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: CATALOG_PAGE_SIZE, total: 0, totalPages: 0 });
  const debouncedSearch = useDebouncedValue(filters.search, 600);
  const currentPage = pageFromSearchParams(searchParams);
  const requestRef = useRef(0);
  const externalQueryRef = useRef(null);
  const filterSignatureRef = useRef(JSON.stringify({ filters, selectedBrands }));
  const {
    showProductReaction,
    celebrateProduct,
    celebrateAri,
    clearReaction
  } = useAriMascot();

  useEffect(() => {
    const incomingQuery = searchParams.toString();
    const stateQuery = buildSearchParams(filters, selectedBrands, currentPage).toString();
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
      brand: selectedBrands.join(","),
      page: currentPage,
      limit: CATALOG_PAGE_SIZE
    };
    const params = new URLSearchParams(Object.entries(backendFilters).filter(([, value]) => value));
    return params.toString() ? `?${params}` : "";
  }, [filters, debouncedSearch, selectedBrands, currentPage]);

  useEffect(() => {
    const signature = JSON.stringify({ filters, selectedBrands });
    if (externalQueryRef.current !== null) {
      const synchronizedQuery = buildSearchParams(filters, selectedBrands, currentPage).toString();
      filterSignatureRef.current = signature;
      if (synchronizedQuery === externalQueryRef.current) externalQueryRef.current = null;
      return;
    }
    const filtersChanged = filterSignatureRef.current !== signature;
    filterSignatureRef.current = signature;
    const params = buildSearchParams(filters, selectedBrands, filtersChanged ? 1 : currentPage);
    const nextQuery = params.toString();
    if (nextQuery !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [filters, selectedBrands, currentPage, searchParams, setSearchParams]);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [result, cats] = await Promise.all([
          getCostumePage(query, { signal: controller.signal }),
          categories.length ? Promise.resolve(categories) : getCategories()
        ]);
        if (requestRef.current !== requestId) return;
        setProducts(result.items);
        setPagination(result.pagination);
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
  }, [query, selectedBrands, reloadKey]);

  const filterTitle = titleForFilters(filters, selectedBrands, categories);
  const hasActiveFilters = buildSearchParams({ ...filters, sort: "" }, selectedBrands).toString().length > 0;
  const openProduct = (product) => setView(views.detail, paths.detail(product.id || product._id));
  const goToPage = (page) => {
    const target = Math.max(1, Math.min(page, Math.max(1, pagination.totalPages || 1)));
    setSearchParams(buildSearchParams(filters, selectedBrands, target));
    document.querySelector(".catalog-two-column")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
            {!loading && !error && <div className="catalog-result-count" role="status"><strong>{pagination.total}</strong> trang phục phù hợp{hasActiveFilters ? " với bộ lọc đang chọn" : ""}</div>}
            <BrandFilterGrid selectedBrands={selectedBrands} setSelectedBrands={(next) => {
              const value = typeof next === "function" ? next(selectedBrands) : next;
              if (!sameStringArray(value, selectedBrands)) setSelectedBrands(value);
            }} />
            {loading && <StateMessage text="Đang tải sản phẩm..." />}
            {error && <StateMessage text={error} tone="error" actionLabel="Thử lại" onAction={() => setReloadKey((key) => key + 1)} />}
            {!loading && !error && products.length === 0 && <StateMessage text="Chưa có trang phục phù hợp với bộ lọc này." />}
            {!loading && !error && <div className="mei-product-grid mei-catalog-grid">
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
            </div>}
            {!loading && !error && pagination.totalPages > 1 && (
              <nav className="pagination catalog-pagination" aria-label="Phân trang danh sách trang phục">
                <button type="button" disabled={!pagination.hasPreviousPage} onClick={() => goToPage(currentPage - 1)}>Trước</button>
                <span>Trang {pagination.page} / {pagination.totalPages}</span>
                <button type="button" disabled={!pagination.hasNextPage} onClick={() => goToPage(currentPage + 1)}>Sau</button>
              </nav>
            )}
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
