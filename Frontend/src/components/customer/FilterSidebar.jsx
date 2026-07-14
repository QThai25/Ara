import React, { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";

import {
  occasions,
  styles
} from "../../utils/catalogData.js";

const fallbackCategories = [
  { label: "Đầm", slug: "dam" },
  { label: "Áo dài", slug: "ao-dai" },
  { label: "Set bộ", slug: "set-bo" },
  { label: "Chân váy", slug: "chan-vay" },
  { label: "Đồ bơi", slug: "do-boi" },
  { label: "Áo", slug: "ao" },
  { label: "Quần", slug: "quan" }
];

const colorOptions = [
  ["Bạc", "#c9c9c9"],
  ["Be", "#dfcdb6"],
  ["Cam", "#ef8b3a"],
  ["Đen", "#111111"],
  ["Đỏ", "#cf2d2d"],
  ["Gold", "#d2a84b"],
  ["Hồng", "#f5a6c8"],
  ["Kem", "#f4ead7"],
  ["Mint", "#a7e9d5"],
  ["Nâu", "#8d5a36"],
  ["Nude", "#d7b49e"],
  ["Pastel", "#d9cdf7"],
  ["Sequin", "#b6b6c8"],
  ["Tím", "#8e5bd8"],
  ["Trắng", "#ffffff"],
  ["Vàng", "#f1d54f"],
  ["Xám", "#9b9b9b"],
  ["Xanh dương", "#4f8fe8"],
  ["Xanh lá", "#4caa63"]
];

const sizeOptions = [
  "S",
  "M",
  "L",
  "Freesize"
];

const priceOptions = [
  {
    label: "Dưới 300.000đ",
    minPrice: "",
    maxPrice: "300000"
  },
  {
    label: "300.000đ - 500.000đ",
    minPrice: "300000",
    maxPrice: "500000"
  },
  {
    label: "500.000đ - 1.000.000đ",
    minPrice: "500000",
    maxPrice: "1000000"
  },
  {
    label: "Trên 1.000.000đ",
    minPrice: "1000000",
    maxPrice: ""
  }
];

function CheckItem({
  label,
  checked,
  onChange,
  swatch
}) {
  return (
    <label
      className={`filter-check ${
        checked ? "is-selected" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />

      {swatch && (
        <span
          className="color-swatch"
          style={{ backgroundColor: swatch }}
          aria-hidden="true"
        />
      )}

      <span className="filter-check-label">
        {label}
      </span>
    </label>
  );
}

function FilterAccordion({
  id,
  title,
  open,
  activeCount = 0,
  onToggle,
  children
}) {
  return (
    <section
      className={`filter-accordion ${
        open ? "is-open" : ""
      }`}
    >
      <button
        type="button"
        className="filter-accordion-trigger"
        aria-expanded={open}
        aria-controls={`filter-panel-${id}`}
        onClick={onToggle}
      >
        <span className="filter-accordion-title">
          {title}

          {activeCount > 0 && (
            <small>{activeCount}</small>
          )}
        </span>

        <ChevronDown
          className="filter-accordion-chevron"
          size={17}
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </button>

      <div
        id={`filter-panel-${id}`}
        className="filter-accordion-collapse"
      >
        <div className="filter-accordion-overflow">
          <div className="filter-accordion-content">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FilterSidebar({
  filters,
  setFilters,
  categories = [],
  onClear
}) {
  const [openGroups, setOpenGroups] = useState({
    categories: true,
    occasions: true,
    styles: false,
    colors: false,
    sizes: false,
    prices: false
  });

  const categoryOptions = categories.length
    ? categories
        .map((category) => ({
          label: category.name,
          slug:
            category.slug ||
            category.id ||
            category._id
        }))
        .filter(
          (item) => item.label && item.slug
        )
    : fallbackCategories;

  const toggleGroup = (group) => {
    setOpenGroups((current) => ({
      ...current,
      [group]: !current[group]
    }));
  };

  const clearFilters = () => {
    if (onClear) {
      onClear();
      return;
    }

    setFilters({
      search: "",
      category: "",
      size: "",
      color: "",
      occasion: "",
      style: "",
      minPrice: "",
      maxPrice: "",
      status: "available"
    });
  };

  const priceSelected =
    Boolean(filters.minPrice || filters.maxPrice);

  return (
    <aside className="filter-sidebar">
      <div className="filter-sidebar-heading">
        <div>
          <span>Tìm theo sở thích</span>
          <h2>Bộ lọc sản phẩm</h2>
        </div>

        <button
          type="button"
          className="filter-reset-icon"
          onClick={clearFilters}
          aria-label="Xóa toàn bộ bộ lọc"
          title="Xóa bộ lọc"
        >
          <RotateCcw
            size={17}
            strokeWidth={1.7}
          />
        </button>
      </div>

      <div className="filter-accordion-list">
        <FilterAccordion
          id="categories"
          title="Danh mục sản phẩm"
          open={openGroups.categories}
          activeCount={filters.category ? 1 : 0}
          onToggle={() =>
            toggleGroup("categories")
          }
        >
          {categoryOptions.map((item) => (
            <CheckItem
              key={item.slug}
              label={item.label}
              checked={
                filters.category === item.slug
              }
              onChange={() =>
                setFilters({
                  ...filters,
                  category:
                    filters.category === item.slug
                      ? ""
                      : item.slug
                })
              }
            />
          ))}
        </FilterAccordion>

        <FilterAccordion
          id="occasions"
          title="Dịp mặc"
          open={openGroups.occasions}
          activeCount={filters.occasion ? 1 : 0}
          onToggle={() =>
            toggleGroup("occasions")
          }
        >
          {occasions.map((item) => (
            <CheckItem
              key={item.slug}
              label={item.label}
              checked={
                filters.occasion === item.slug
              }
              onChange={() =>
                setFilters({
                  ...filters,
                  occasion:
                    filters.occasion === item.slug
                      ? ""
                      : item.slug
                })
              }
            />
          ))}
        </FilterAccordion>

        <FilterAccordion
          id="styles"
          title="Phong cách"
          open={openGroups.styles}
          activeCount={filters.style ? 1 : 0}
          onToggle={() =>
            toggleGroup("styles")
          }
        >
          {styles.map((item) => (
            <CheckItem
              key={item.slug}
              label={item.label}
              checked={
                filters.style === item.slug
              }
              onChange={() =>
                setFilters({
                  ...filters,
                  style:
                    filters.style === item.slug
                      ? ""
                      : item.slug
                })
              }
            />
          ))}
        </FilterAccordion>

        <FilterAccordion
          id="colors"
          title="Màu sắc"
          open={openGroups.colors}
          activeCount={filters.color ? 1 : 0}
          onToggle={() =>
            toggleGroup("colors")
          }
        >
          <div className="filter-color-grid">
            {colorOptions.map(
              ([label, color]) => (
                <CheckItem
                  key={label}
                  label={label}
                  swatch={color}
                  checked={
                    filters.color === label
                  }
                  onChange={() =>
                    setFilters({
                      ...filters,
                      color:
                        filters.color === label
                          ? ""
                          : label
                    })
                  }
                />
              )
            )}
          </div>
        </FilterAccordion>

        <FilterAccordion
          id="sizes"
          title="Kích thước"
          open={openGroups.sizes}
          activeCount={filters.size ? 1 : 0}
          onToggle={() =>
            toggleGroup("sizes")
          }
        >
          <div className="filter-size-grid">
            {sizeOptions.map((size) => (
              <CheckItem
                key={size}
                label={size}
                checked={filters.size === size}
                onChange={() =>
                  setFilters({
                    ...filters,
                    size:
                      filters.size === size
                        ? ""
                        : size
                  })
                }
              />
            ))}
          </div>
        </FilterAccordion>

        <FilterAccordion
          id="prices"
          title="Khoảng giá"
          open={openGroups.prices}
          activeCount={priceSelected ? 1 : 0}
          onToggle={() =>
            toggleGroup("prices")
          }
        >
          {priceOptions.map((option) => {
            const checked =
              filters.minPrice ===
                option.minPrice &&
              filters.maxPrice ===
                option.maxPrice;

            return (
              <CheckItem
                key={option.label}
                label={option.label}
                checked={checked}
                onChange={() =>
                  setFilters({
                    ...filters,
                    minPrice: checked
                      ? ""
                      : option.minPrice,
                    maxPrice: checked
                      ? ""
                      : option.maxPrice
                  })
                }
              />
            );
          })}
        </FilterAccordion>
      </div>

      <button
        type="button"
        className="clear-filter"
        onClick={clearFilters}
      >
        <RotateCcw
          size={15}
          strokeWidth={1.8}
        />
        Xóa toàn bộ bộ lọc
      </button>
    </aside>
  );
}