import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Expand,
  FileText,
  Image as ImageIcon,
  Package,
  Pencil,
  Settings2,
  Shirt,
  Tag
} from "lucide-react";

import React, {
  useEffect,
  useMemo,
  useState
} from "react";
import { createPortal } from "react-dom";

import {
  useNavigate,
  useParams
} from "react-router-dom";

import {
  AdminDetailSection,
  AdminPageHeader,
  AdminStatusBadge
} from "../components/common/AdminUI.jsx";

import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { getById, update as updateCostume } from "../services/adminCostumeService.js";
import { getAdminBrands } from "../services/brandService.js";
import { getAdminCategories } from "../services/categoryService.js";
import { getAdminOccasions, getAdminStyles } from "../services/filterOptionService.js";

import {
  formatDateTime,
  money,
  normalizeCostume,
  resolveImageUrl
} from "../utils/format.js";
import { normalizeCostumeEditorPayload } from "../utils/costumeEditor.js";
import { CostumeFormModal } from "./AdminPage.jsx";

const EMPTY_TEXT = "Chưa có";

export function AdminCostumeDetailPage({ notify = () => {} }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAdminAuth();
  const canManageCatalog = can(P.CATALOG_MANAGE);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCatalogLoading, setEditorCatalogLoading] = useState(canManageCatalog);
  const [editorCatalog, setEditorCatalog] = useState({
    categories: [],
    brands: [],
    occasions: [],
    styles: []
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");
      setActiveImageIndex(0);

      try {
        const data = await getById(id);

        if (alive) {
          setItem(data);
        }
      } catch (err) {
        if (alive) {
          setError(
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Không thể tải chi tiết trang phục."
          );
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!canManageCatalog) {
      setEditorCatalogLoading(false);
      return undefined;
    }

    let alive = true;
    setEditorCatalogLoading(true);

    Promise.all([
      getAdminCategories(),
      getAdminBrands(),
      getAdminOccasions(),
      getAdminStyles()
    ])
      .then(([categories, brands, occasions, styles]) => {
        if (!alive) return;
        setEditorCatalog({ categories, brands, occasions, styles });
      })
      .catch((error) => {
        if (alive) notify(error.message || "Không thể tải dữ liệu biểu mẫu.", "error");
      })
      .finally(() => {
        if (alive) setEditorCatalogLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [canManageCatalog, notify]);

  const saveCostume = async (payload) => {
    try {
      const response = await updateCostume(
        id,
        normalizeCostumeEditorPayload(payload)
      );
      const updated = response?.data
        ? normalizeCostume(response.data)
        : await getById(id);

      setItem(updated);
      setEditorOpen(false);
      notify(response?.message || "Cập nhật trang phục thành công.");
    } catch (error) {
      notify(error.message || "Không thể cập nhật trang phục.", "error");
      throw error;
    }
  };

  const images = useMemo(() => {
    const source = item?.images?.length
      ? item.images
      : [item?.image];

    return Array.from(
      new Set(source.filter(Boolean))
    );
  }, [item]);

  const activeImage =
    images[activeImageIndex] ||
    images[0] ||
    "";

  const changeImage = (direction) => {
    if (images.length < 2) return;

    setActiveImageIndex((current) =>
      (current + direction + images.length) %
      images.length
    );
  };

  useEffect(() => {
    if (!lightboxOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
      } else if (event.key === "ArrowLeft") {
        changeImage(-1);
      } else if (event.key === "ArrowRight") {
        changeImage(1);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [images.length, lightboxOpen]);

  const brandName = getRelationName(
    item?.brandName,
    item?.brand
  );

  const categoryName = getRelationName(
    item?.categoryName,
    item?.category
  );

  const occasionName = getRelationName(
    item?.occasions?.map((entry) => entry.name).filter(Boolean).join(", "),
    item?.occasionName,
    item?.occasion
  );

  const styleName = getRelationName(
    item?.styles?.map((entry) => entry.name).filter(Boolean).join(", "),
    item?.styleName,
    item?.style
  );

  return (
    <section className="admin-costume-detail-page">
      <div className="admin-costume-detail-toolbar">
        <button
          type="button"
          className="admin-costume-back-button"
          onClick={() => navigate("/costumes")}
        >
          <ArrowLeft size={17} />
          Quay lại danh sách
        </button>

        <span className="admin-costume-detail-eyebrow">
          HỒ SƠ TRANG PHỤC
        </span>
      </div>

      {loading && (
        <StateMessage text="Đang tải chi tiết trang phục..." />
      )}

      {error && (
        <StateMessage
          text={error}
          tone="error"
        />
      )}

      {!loading && !error && !item && (
        <StateMessage text="Không tìm thấy trang phục." />
      )}

      {!loading && !error && item && (
        <>
          <div className="admin-costume-detail-hero">
            <AdminPageHeader
              title={item.name || "Trang phục chưa đặt tên"}
              description={
                item.skuCode
                  ? `Mã trang phục: ${item.skuCode}`
                  : "Thông tin chi tiết trang phục"
              }
              action={
                <AdminStatusBadge
                  type="costume"
                  value={item.status}
                />
              }
            />
          </div>

          <div className="admin-costume-summary-strip">
            <SummaryItem
              icon={<Tag size={17} />}
              label="Mã SKU"
              value={item.skuCode}
            />

            <SummaryItem
              icon={<Package size={17} />}
              label="Số lượng"
              value={
                hasValue(item.quantity)
                  ? `${item.quantity} sản phẩm`
                  : null
              }
            />

            <SummaryItem
              icon={<CalendarClock size={17} />}
              label="Cập nhật gần nhất"
              value={formatDateTime(item.updatedAt)}
            />
          </div>

          <div className="admin-costume-detail-grid">
            <div className="admin-costume-grid-item is-gallery">
              <AdminDetailSection
                icon={<ImageIcon />}
                title="Hình ảnh trang phục"
              >
                {images.length > 0 ? (
                  <div className="admin-costume-media">
                    <div className="admin-costume-main-image">
                      <button
                        type="button"
                        className="admin-costume-image-open"
                        onClick={() => setLightboxOpen(true)}
                        aria-label={`Mở ảnh ${activeImageIndex + 1} ở kích thước lớn`}
                      >
                        <img
                          className="admin-costume-image-backdrop"
                          src={resolveImageUrl(activeImage)}
                          alt=""
                          aria-hidden="true"
                          onError={handleImageError}
                        />

                        <img
                          className="admin-costume-image-content"
                          src={resolveImageUrl(activeImage)}
                          alt={item.name || "Trang phục"}
                          onError={handleImageError}
                        />

                        <span className="admin-costume-image-open-hint">
                          <Expand size={16} />
                          Xem ảnh lớn
                        </span>
                      </button>

                      {images.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="admin-costume-image-nav is-previous"
                            onClick={() => changeImage(-1)}
                            aria-label="Xem ảnh trước"
                          >
                            <ChevronLeft size={19} />
                          </button>
                          <button
                            type="button"
                            className="admin-costume-image-nav is-next"
                            onClick={() => changeImage(1)}
                            aria-label="Xem ảnh tiếp theo"
                          >
                            <ChevronRight size={19} />
                          </button>
                        </>
                      )}

                      <span className="admin-costume-image-counter">
                        Ảnh {activeImageIndex + 1}/{images.length}
                      </span>
                    </div>

                    {images.length > 0 && (
                      <div className="admin-costume-thumbnail-list">
                        {images.map((image, index) => (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            className={
                              index === activeImageIndex
                                ? "is-active"
                                : ""
                            }
                            aria-label={`Xem ảnh ${index + 1}`}
                            aria-pressed={
                              index === activeImageIndex
                            }
                            onDoubleClick={() => {
                              setActiveImageIndex(index);
                              setLightboxOpen(true);
                            }}
                            onClick={() =>
                              setActiveImageIndex(index)
                            }
                          >
                            <img
                              src={resolveImageUrl(image)}
                              alt={`${item.name || "Trang phục"} ${index + 1
                                }`}
                              onError={handleImageError}
                            />
                            <span>{index + 1}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="admin-costume-gallery-help">
                      <Expand size={14} />
                      Bấm vào ảnh chính để xem toàn màn hình. Bấm đúp thumbnail để mở nhanh.
                    </p>
                  </div>
                ) : (
                  <div className="admin-costume-gallery-empty">
                    <ImageIcon size={28} />

                    <strong>Chưa có hình ảnh</strong>

                    <span>
                      Hãy cập nhật hình ảnh để việc quản lý trang phục
                      trực quan hơn.
                    </span>
                  </div>
                )}
              </AdminDetailSection>
            </div>

            <div className="admin-costume-grid-item is-information">
              <AdminDetailSection
                icon={<Shirt />}
                title="Thông tin trang phục"
              >
                <div className="admin-costume-info-grid">
                  <Info
                    label="Thương hiệu"
                    value={brandName}
                  />

                  <Info
                    label="Danh mục"
                    value={categoryName}
                  />

                  <Info
                    label="Dịp mặc"
                    value={occasionName}
                  />

                  <Info
                    label="Phong cách"
                    value={styleName}
                  />

                  <Info
                    label="Chất liệu"
                    value={item.material}
                  />

                  <Info
                    label="Màu sắc"
                    value={item.color}
                  />

                  <Info
                    label="Kích thước"
                    value={item.size}
                  />

                  <Info
                    label="Số lượng"
                    value={item.quantity}
                  />
                </div>
              </AdminDetailSection>
            </div>

            <div className="admin-costume-grid-item is-management">
              <AdminDetailSection
                icon={<CalendarClock />}
                title="Thông tin quản lý"
              >
                <div className="admin-costume-management-list">
                  <ManagementRow
                    label="Mã trang phục"
                    value={item.skuCode}
                  />

                  <ManagementRow
                    label="Tổng số lượng"
                    value={item.quantity}
                  />

                  <ManagementRow
                    label="Số lượng khả dụng"
                    value={
                      item.availableQuantity ??
                      item.availableStock ??
                      item.quantity
                    }
                  />

                  <ManagementRow
                    label="Ngày tạo"
                    value={formatDateTime(item.createdAt)}
                  />

                  <ManagementRow
                    label="Cập nhật gần nhất"
                    value={formatDateTime(item.updatedAt)}
                  />
                </div>
              </AdminDetailSection>
            </div>

            <div className="admin-costume-grid-item is-price">
              <AdminDetailSection
                icon={<CircleDollarSign />}
                title="Thông tin giá"
              >
                <div className="admin-costume-price-grid">
                  <PriceItem
                    label="Giá gốc"
                    value={item.originalPrice}
                    description="Giá trị gốc của trang phục"
                  />

                  <PriceItem
                    label="Giá thuê mỗi ngày"
                    value={
                      item.rentalPricePerDay ??
                      item.rentalPrice
                    }
                    description="Mức giá thuê tiêu chuẩn"
                    tone="primary"
                  />

                  <PriceItem
                    label="Giá thành viên"
                    value={item.memberPrice}
                    description="Giá ưu đãi dành cho thành viên"
                  />

                  <PriceItem
                    label="Tiền đặt cọc"
                    value={item.depositAmount}
                    description="Khoản cọc cần thu khi thuê"
                    tone="deposit"
                  />
                </div>
              </AdminDetailSection>
            </div>

            <div className="admin-costume-grid-item is-actions">
              <AdminDetailSection
                icon={<Settings2 />}
                title="Thao tác quản lý"
              >
                <div className="admin-costume-action-panel">
                  <div className="admin-costume-action-copy">
                    <strong>Cập nhật thông tin trang phục</strong>

                    <span>
                      Chỉnh sửa giá thuê, số lượng, hình ảnh, mô tả và
                      các thông tin phân loại.
                    </span>
                  </div>

                  <div className="admin-costume-action-buttons">
                    {canManageCatalog && (
                      <button
                        type="button"
                        className="admin-costume-edit-button"
                        disabled={editorCatalogLoading}
                        onClick={() => setEditorOpen(true)}
                      >
                        <Pencil size={17} />
                        {editorCatalogLoading ? "Đang chuẩn bị..." : "Sửa trang phục"}
                      </button>
                    )}

                    <button
                      type="button"
                      className="admin-costume-secondary-button"
                      onClick={() => navigate("/costumes")}
                    >
                      <ArrowLeft size={17} />
                      Quay lại danh sách
                    </button>
                  </div>
                </div>
              </AdminDetailSection>
            </div>

            <div className="admin-costume-grid-item is-description">
              <AdminDetailSection
                icon={<FileText />}
                title="Mô tả trang phục"
              >
                <div
                  className={[
                    "admin-costume-description",
                    item.description ? "" : "is-empty"
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.description || "Trang phục chưa có mô tả."}
                </div>
              </AdminDetailSection>
            </div>
          </div>
        </>
      )}

      {editorOpen && item && (
        <CostumeFormModal
          title="Sửa trang phục"
          initial={item}
          categories={editorCatalog.categories}
          brands={editorCatalog.brands}
          occasions={editorCatalog.occasions}
          styles={editorCatalog.styles}
          notify={notify}
          onClose={() => setEditorOpen(false)}
          onSave={saveCostume}
        />
      )}

      {lightboxOpen && item && activeImage && createPortal(
        <div
          className="admin-costume-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Xem hình ảnh ${item.name || "trang phục"}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setLightboxOpen(false);
            }
          }}
        >
          <button
            type="button"
            className="admin-costume-image-lightbox-close"
            onClick={() => setLightboxOpen(false)}
          >
            Đóng
          </button>

          <img
            src={resolveImageUrl(activeImage)}
            alt={`${item.name || "Trang phục"} - ảnh ${activeImageIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
            onError={handleImageError}
          />
        </div>,
        document.body
      )}
    </section>
  );
}

function OrderSummaryItem({
  icon,
  label,
  value
}) {
  const hasValue =
    value !== undefined &&
    value !== null &&
    value !== "";

  return (
    <div className="admin-order-summary-item">
      <span className="admin-order-summary-icon">
        {icon}
      </span>

      <div>
        <small>{label}</small>
        <strong>
          {hasValue ? value : "-"}
        </strong>
      </div>
    </div>
  );
}
function SummaryItem({
  icon,
  label,
  value
}) {
  return (
    <div className="admin-costume-summary-item">
      <span className="admin-costume-summary-icon">
        {icon}
      </span>

      <div>
        <small>{label}</small>
        <strong>{displayValue(value)}</strong>
      </div>
    </div>
  );
}

function Info({
  label,
  value
}) {
  return (
    <div className="admin-costume-info-item">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

function ManagementRow({
  label,
  value
}) {
  return (
    <div className="admin-costume-management-row">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

function PriceItem({
  label,
  value,
  description,
  tone = ""
}) {
  return (
    <div
      className={[
        "admin-costume-price-item",
        tone ? `is-${tone}` : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>{displayMoney(value)}</strong>
      <small>{description}</small>
    </div>
  );
}

function hasValue(value) {
  return !(
    value === undefined ||
    value === null ||
    value === ""
  );
}

function displayValue(value) {
  if (!hasValue(value)) {
    return EMPTY_TEXT;
  }

  if (Array.isArray(value)) {
    return value.length
      ? value
        .map((entry) => displayValue(entry))
        .join(", ")
      : EMPTY_TEXT;
  }

  if (typeof value === "object") {
    return (
      value.name ||
      value.title ||
      value.label ||
      EMPTY_TEXT
    );
  }

  return value;
}

function getRelationName(primaryValue, relationValue) {
  if (hasValue(primaryValue)) {
    return displayValue(primaryValue);
  }

  return displayValue(relationValue);
}

function displayMoney(value) {
  if (!hasValue(value)) {
    return EMPTY_TEXT;
  }

  return money(value);
}

function handleImageError(event) {
  if (
    event.currentTarget.getAttribute("src") !==
    "/placeholder.png"
  ) {
    event.currentTarget.src = "/placeholder.png";
  }
}

export default AdminCostumeDetailPage;
