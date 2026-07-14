import React, {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ChevronDown,
  RotateCcw
} from "lucide-react";

import { getActiveBrands } from "../../services/brandService.js";

export function BrandFilterGrid({
  selectedBrands = [],
  setSelectedBrands
}) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let disposed = false;

    const loadBrands = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getActiveBrands();

        const items = Array.isArray(response)
          ? response
          : response?.brands || response?.data || [];

        if (!disposed) {
          setBrands(items);
        }
      } catch (err) {
        if (!disposed) {
          setError(
            err.message ||
              "Không thể tải danh sách thương hiệu."
          );
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    loadBrands();

    return () => {
      disposed = true;
    };
  }, []);

  const selectedCount = useMemo(
    () =>
      brands.filter((brand) =>
        selectedBrands.includes(brand.slug)
      ).length,
    [brands, selectedBrands]
  );

  const toggle = (brandSlug) => {
    setSelectedBrands((current = []) =>
      current.includes(brandSlug)
        ? current.filter(
            (item) => item !== brandSlug
          )
        : [...current, brandSlug]
    );
  };

  const clearBrands = () => {
    setSelectedBrands([]);
  };

  if (!loading && !error && brands.length === 0) {
    return null;
  }

  return (
    <section
      className={`brand-filter-panel ${
        open ? "is-open" : ""
      }`}
    >
      <div className="brand-filter-heading">
        <button
          type="button"
          className="brand-filter-toggle"
          aria-expanded={open}
          aria-controls="brand-filter-content"
          onClick={() =>
            setOpen((current) => !current)
          }
        >
          <span className="brand-filter-title">
            <small>Chọn theo nhà thiết kế</small>

            <span>
              Thương hiệu

              {selectedCount > 0 && (
                <strong>{selectedCount}</strong>
              )}
            </span>
          </span>

          <ChevronDown
            className="brand-filter-chevron"
            size={20}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>

        {selectedCount > 0 && (
          <button
            type="button"
            className="brand-filter-clear"
            onClick={clearBrands}
            aria-label="Xóa bộ lọc thương hiệu"
            title="Xóa thương hiệu đã chọn"
          >
            <RotateCcw
              size={16}
              strokeWidth={1.7}
            />
          </button>
        )}
      </div>

      <div
        id="brand-filter-content"
        className="brand-filter-collapse"
      >
        <div className="brand-filter-overflow">
          <div className="brand-filter-content">
            {loading && (
              <p className="brand-filter-message">
                Đang tải thương hiệu...
              </p>
            )}

            {error && (
              <p className="brand-filter-message is-error">
                {error}
              </p>
            )}

            {!loading && !error && (
              <div className="brand-checkbox-grid">
                {brands.map((brand) => {
                  const checked =
                    selectedBrands.includes(
                      brand.slug
                    );

                  return (
                    <label
                      key={brand._id || brand.slug}
                      className={`brand-filter-option ${
                        checked ? "is-selected" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggle(brand.slug)
                        }
                      />

                      <span
                        className="brand-filter-checkmark"
                        aria-hidden="true"
                      />

                      <span
                        className="brand-filter-monogram"
                        aria-hidden="true"
                      >
                        {brand.name
                          ?.trim()
                          .charAt(0)
                          .toUpperCase() || "A"}
                      </span>

                      <span className="brand-filter-name">
                        {brand.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}