import React, {
  useEffect,
  useRef,
  useState
} from "react";
import {
  ArrowUpRight
} from "lucide-react";
import {
  Link,
  useLocation
} from "react-router-dom";

import {
  getActiveBrands
} from "../../services/brandService.js";

export function BrandDropdown({
  closeMenu
}) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const location = useLocation();
  const brandCloseTimerRef = useRef(null);
  const openBrandMenu = () => {
    window.clearTimeout(brandCloseTimerRef.current);
    setBrandOpen(true);
  };

  const closeBrandMenuLater = () => {
    window.clearTimeout(brandCloseTimerRef.current);

    brandCloseTimerRef.current = window.setTimeout(() => {
      setBrandOpen(false);
    }, 220);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(brandCloseTimerRef.current);
    };
  }, []);

  const selectedBrands =
    new URLSearchParams(
      location.search
    ).getAll("brand");

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await getActiveBrands();

        const items = Array.isArray(response)
          ? response
          : response?.data ||
          response?.brands ||
          [];

        if (!disposed) {
          setBrands(items);
        }
      } catch (err) {
        if (!disposed) {
          setError(
            err.message ||
            "Không thể tải thương hiệu."
          );
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="brand-dropdown">
      <div className="brand-dropdown-heading">
        <div>
          <span>Nhà thiết kế</span>
          <strong>Thương hiệu nổi bật</strong>
        </div>

        <Link
          to="/brands"
          onClick={closeMenu}
        >
          Xem tất cả
          <ArrowUpRight
            size={14}
            strokeWidth={1.8}
          />
        </Link>
      </div>

      <div className="brand-dropdown-divider" />

      {loading && (
        <p className="brand-dropdown-message">
          Đang tải thương hiệu...
        </p>
      )}

      {error && (
        <p className="brand-dropdown-message is-error">
          {error}
        </p>
      )}

      {!loading &&
        !error &&
        brands.length === 0 && (
          <p className="brand-dropdown-message">
            Chưa có thương hiệu.
          </p>
        )}

      {!loading &&
        !error &&
        brands.length > 0 && (
          <div className="brand-dropdown-list">
            {brands.map((brand) => {
              const active =
                selectedBrands.includes(
                  brand.slug
                );

              return (
                <Link
                  key={
                    brand._id ||
                    brand.slug
                  }
                  className={
                    active
                      ? "brand-dropdown-item active"
                      : "brand-dropdown-item"
                  }
                  to={`/costumes?brand=${encodeURIComponent(
                    brand.slug
                  )}`}
                  onClick={closeMenu}
                >
                  <span className="brand-dropdown-monogram">
                    {String(
                      brand.name || "A"
                    )
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <span className="brand-dropdown-name">
                    {brand.name}
                  </span>

                  <ArrowUpRight
                    className="brand-dropdown-arrow"
                    size={14}
                    strokeWidth={1.7}
                  />
                </Link>
              );
            })}
          </div>
        )}
    </div>
  );
}