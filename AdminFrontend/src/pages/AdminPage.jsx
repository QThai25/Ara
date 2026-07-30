import { useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { OrderDetail } from "../components/common/OrderDetail.jsx";
import { AdminActionMenu, AdminFilterBar, AdminSelect, AdminSelectFilter, AdminStatCard, AdminStatusBadge } from "../components/common/AdminUI.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { AdminModal, ModalDatePicker, ModalMultiSelect, ModalSelect, MoneyThousandsInput, PlainNumberInput } from "../components/common/AdminControls.jsx";
import { MultiImageUploader } from "../components/common/MultiImageUploader.jsx";
import { StatusBadge } from "../components/common/StatusBadge.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { getAdminCustomers, getAdminDashboard, getAdminOrders, getAdminPayments, runAdminOrderAction } from "../services/adminService.js";
import * as costumeApi from "../services/adminCostumeService.js";
import { createBrand, deleteBrand, getAdminBrands, toggleBrandStatus, updateBrand } from "../services/brandService.js";
import { createCategory, deleteCategory, getAdminCategories, toggleCategoryStatus, updateCategory } from "../services/categoryService.js";
import { createBanner, getAdminBanners, removeBanner, setPrimaryBanner, toggleBannerStatus, updateBanner } from "../services/bannerService.js";
import { createVoucher, getAdminVouchers, mockVouchers, removeVoucher, toggleVoucherStatus, updateVoucher } from "../services/voucherService.js";
import { confirmPayment, getAdminPaymentDetail, getAdminPayments as fetchAdminPayments, rejectPayment } from "../services/paymentService.js";
import { createOccasion, createStyle, deleteOccasion, deleteStyle, getAdminOccasions, getAdminStyles, toggleOccasionStatus, toggleStyleStatus, updateOccasion, updateStyle } from "../services/filterOptionService.js";
import { createReturnInspection, rejectRentalOrder } from "../services/rentalOrderService.js";
import { uploadImages } from "../services/uploadService.js";
import { costumeName, formatDate, formatDateTime, getStatusLabel, money, orderTotal, resolveImageUrl } from "../utils/format.js";
import { normalizeCostumeEditorPayload } from "../utils/costumeEditor.js";
import { costumeStatusOptions as sharedCostumeStatusOptions } from "../utils/status.js";
import { adminTabs } from "./adminTabs.js";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Eye,
  EyeOff,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shirt,
  SlidersHorizontal,
  Trash2,
  Users,
  X
} from "lucide-react";


import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";

const asArray = (value) => (Array.isArray(value) ? value : []);
const itemId = (item) => item?.id || item?._id || item?.code || "";
const findById = (items, id) => asArray(items).find((item) => itemId(item) === id) || null;

const costumeStatusOptions = sharedCostumeStatusOptions;

const occasionOptions = [
  ["party", "Dự tiệc"],
  ["travel", "Du lịch"],
  ["gala", "Dạ hội"],
  ["office", "Công sở"],
  ["festival", "Lễ hội"],
  ["date-walk", "Hẹn hò dạo phố"],
  ["relax", "Thư giãn"],
  ["beach", "Bãi biển"],
  ["set", "Thuê theo set"]
];

const styleOptions = [
  ["traditional", "Truyền thống"],
  ["princess", "Công chúa"],
  ["vintage-bohemian", "Vintage - Bohemian"],
  ["personality", "Cá tính"],
  ["dynamic", "Năng động"],
  ["casual", "Casual"],
  ["sexy", "Gợi cảm"],
  ["elegant", "Thanh lịch"]
];

const fallbackOccasionOptions = [
  { value: "party", label: "Dự tiệc", slug: "party", name: "Dự tiệc", icon: "party", status: "active" },
  { value: "travel", label: "Du lịch", slug: "travel", name: "Du lịch", icon: "travel", status: "active" },
  { value: "gala", label: "Dạ hội", slug: "gala", name: "Dạ hội", icon: "gala", status: "active" },
  { value: "office", label: "Công sở", slug: "office", name: "Công sở", icon: "office", status: "active" },
  { value: "festival", label: "Lễ hội", slug: "festival", name: "Lễ hội", icon: "festival", status: "active" },
  { value: "date-walk", label: "Hẹn hò dạo phố", slug: "date-walk", name: "Hẹn hò dạo phố", icon: "date-walk", status: "active" },
  { value: "relax", label: "Thư giãn", slug: "relax", name: "Thư giãn", icon: "relax", status: "active" },
  { value: "beach", label: "Bãi biển", slug: "beach", name: "Bãi biển", icon: "beach", status: "active" },
  { value: "set", label: "Thuê theo set", slug: "set", name: "Thuê theo set", icon: "set", status: "active" }
];

const fallbackStyleOptions = [
  { value: "traditional", label: "Truyền thống", slug: "traditional", name: "Truyền thống", icon: "traditional", status: "active" },
  { value: "princess", label: "Công chúa", slug: "princess", name: "Công chúa", icon: "princess", status: "active" },
  { value: "vintage-bohemian", label: "Vintage - Bohemian", slug: "vintage-bohemian", name: "Vintage - Bohemian", icon: "vintage-bohemian", status: "active" },
  { value: "personality", label: "Cá tính", slug: "personality", name: "Cá tính", icon: "personality", status: "active" },
  { value: "dynamic", label: "Năng động", slug: "dynamic", name: "Năng động", icon: "dynamic", status: "active" },
  { value: "casual", label: "Casual", slug: "casual", name: "Casual", icon: "casual", status: "active" },
  { value: "sexy", label: "Gợi cảm", slug: "sexy", name: "Gợi cảm", icon: "sexy", status: "active" },
  { value: "elegant", label: "Thanh lịch", slug: "elegant", name: "Thanh lịch", icon: "elegant", status: "active" }
];

export function AdminPage({ activeTab, notify, costumeEditor = null }) {
  const { can } = useAdminAuth();
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [costumes, setCostumes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [occasions, setOccasions] = useState(fallbackOccasionOptions);
  const [styles, setStyles] = useState(fallbackStyleOptions);
  const [vouchers, setVouchers] = useState(mockVouchers);
  const [banners, setBanners] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (keepOrderId = selectedOrderId, { silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const jobs = {};
      if ([adminTabs.dashboard, adminTabs.orders, adminTabs.inspections].includes(activeTab)) jobs.orders = getAdminOrders();
      if ([adminTabs.dashboard, adminTabs.costumes].includes(activeTab)) jobs.costumes = costumeApi.getList();
      if (activeTab === adminTabs.dashboard) jobs.summary = getAdminDashboard();
      if (activeTab === adminTabs.customers) jobs.customers = getAdminCustomers();
      if (activeTab === adminTabs.payments) jobs.payments = getAdminPayments();
      if ([adminTabs.costumes, adminTabs.categories].includes(activeTab)) jobs.categories = getAdminCategories();
      if ([adminTabs.costumes, adminTabs.brands].includes(activeTab)) jobs.brands = getAdminBrands();
      if ([adminTabs.costumes, adminTabs.occasions, adminTabs.categories].includes(activeTab)) jobs.occasions = getAdminOccasions().catch(() => fallbackOccasionOptions);
      if ([adminTabs.costumes, adminTabs.styles, adminTabs.categories].includes(activeTab)) jobs.styles = getAdminStyles().catch(() => fallbackStyleOptions);
      if (activeTab === adminTabs.vouchers) jobs.vouchers = getAdminVouchers().catch(() => mockVouchers);
      if (activeTab === adminTabs.banners) jobs.banners = getAdminBanners().catch(() => []);
      const keys = Object.keys(jobs);
      const values = await Promise.all(Object.values(jobs));
      const loaded = Object.fromEntries(keys.map((key, index) => [key, values[index]]));
      const sum = loaded.summary ?? summary;
      const ord = loaded.orders ?? orders;
      const cos = loaded.costumes ?? costumes;
      const cus = loaded.customers ?? customers;
      const pay = loaded.payments ?? payments;
      const cats = loaded.categories ?? categories;
      const brandList = loaded.brands ?? brands;
      const occasionList = loaded.occasions ?? occasions;
      const styleList = loaded.styles ?? styles;
      const voucherList = loaded.vouchers ?? vouchers;
      const bannerList = loaded.banners ?? banners;
      const safeOrders = asArray(ord);
      setSummary(sum);
      setOrders(safeOrders);
      setCostumes(asArray(cos));
      setCustomers(asArray(cus));
      setPayments(asArray(pay));
      setCategories(asArray(cats));
      setBrands(asArray(brandList));
      setOccasions(asArray(occasionList).length ? asArray(occasionList) : fallbackOccasionOptions);
      setStyles(asArray(styleList).length ? asArray(styleList) : fallbackStyleOptions);
      setVouchers(asArray(voucherList));
      setBanners(asArray(bannerList));
      const nextId = keepOrderId && findById(safeOrders, keepOrderId) ? keepOrderId : (!selectedOrderId ? itemId(safeOrders[0]) : selectedOrderId);
      setSelectedOrderId(nextId || null);
      return safeOrders;
    } catch (err) {
      if (!silent) setError(err.message);
      notify(err.message, "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => load(selectedOrderId), 180); };
    window.addEventListener("ara:order-updated", refresh);
    window.addEventListener("ara:payment-updated", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("ara:order-updated", refresh); window.removeEventListener("ara:payment-updated", refresh); };
  }, [selectedOrderId]);

  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
    const socket = io(base, { auth: { token: localStorage.getItem("ara_admin_token") }, transports: ["websocket", "polling"] });
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => load(selectedOrderId), 120); };
    socket.on("order:updated", refresh);
    socket.on("payment:updated", refresh);
    return () => { clearTimeout(timer); socket.disconnect(); };
  }, [selectedOrderId]);

  const selectedOrder = useMemo(() => findById(orders, selectedOrderId), [orders, selectedOrderId]);

  const dashboardStats = useMemo(() => {
    const renting = orders.filter((order) => order.status === "renting").length;
    const completed = orders.filter((order) => order.status === "completed").length;
    const available = costumes.filter((costume) => costume.currentDisplayStatus === "available").length;
    const laundry = costumes.filter((costume) => costume.currentDisplayStatus === "cleaning").length;
    const heldDeposit = orders
      .filter((order) => ["deposit_paid", "ready_to_pickup", "renting"].includes(order.status))
      .reduce((sum, order) => sum + (order.totalDepositAmount || 0), 0);
    return { renting, completed, available, laundry, heldDeposit };
  }, [orders, costumes]);

  const chrome = (children) => (
    <section className="admin-page">
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={load} />}
      {children}
    </section>
  );

  if (activeTab === adminTabs.dashboard) return chrome(<Dashboard summary={summary} stats={dashboardStats} orders={orders} costumes={costumes} />);
  if (activeTab === adminTabs.costumes) return chrome(<AdminCostumes costumes={costumes} categories={categories} brands={brands} occasions={occasions} styles={styles} notify={notify} reload={() => load(selectedOrderId, { silent: true })} canManageCatalog={can(P.CATALOG_MANAGE)} canOperateInventory={can(P.INVENTORY_OPERATE)} editor={costumeEditor} />);
  if (activeTab === adminTabs.brands) return chrome(<TaxonomyManager title="Quản lý thương hiệu" noun="thương hiệu" items={brands} notify={notify} reload={load} createItem={createBrand} updateItem={updateBrand} deleteItem={deleteBrand} toggleItem={toggleBrandStatus} />);
  if (activeTab === adminTabs.categories) return chrome(<TaxonomyManager title="Quản lý danh mục" noun="danh mục" items={categories} notify={notify} reload={load} createItem={createCategory} updateItem={updateCategory} deleteItem={deleteCategory} toggleItem={toggleCategoryStatus} showIcon defaultOptions={{ occasions, styles }} />);
  if (activeTab === adminTabs.occasions) return chrome(<TaxonomyManager title="Quản lý dịp mặc" noun="dịp mặc" items={occasions} notify={notify} reload={load} createItem={createOccasion} updateItem={updateOccasion} deleteItem={deleteOccasion} toggleItem={toggleOccasionStatus} showIcon />);
  if (activeTab === adminTabs.styles) return chrome(<TaxonomyManager title="Quản lý phong cách" noun="phong cách" items={styles} notify={notify} reload={load} createItem={createStyle} updateItem={updateStyle} deleteItem={deleteStyle} toggleItem={toggleStyleStatus} showIcon />);
  if (activeTab === adminTabs.orders) return chrome(<AdminOrders orders={orders} selected={selectedOrder} selectedOrderId={selectedOrderId} setSelectedOrderId={setSelectedOrderId} notify={notify} reload={load} />);
  if (activeTab === adminTabs.inspections) return chrome(<AdminOrders orders={orders.filter((order) => ["renting", "returned", "overdue"].includes(order.status))} selected={selectedOrder} selectedOrderId={selectedOrderId} setSelectedOrderId={setSelectedOrderId} notify={notify} reload={load} inspectionOnly />);
  if (activeTab === adminTabs.payments) return chrome(<PaymentManager rows={payments} notify={notify} reload={load} canConfirm={can(P.PAYMENTS_CONFIRM_BANK_TRANSFER)} />);
  if (activeTab === adminTabs.customers) return chrome(<SimpleResource title="Quản lý khách hàng" rows={customers} columns={["name", "email", "phone", "status"]} labels={["Tên", "Email", "Số điện thoại", "Trạng thái"]} />);
  if (activeTab === adminTabs.vouchers) return chrome(<VoucherManager items={vouchers} notify={notify} reload={load} />);
  if (activeTab === adminTabs.banners) return chrome(<BannerManager items={banners} notify={notify} reload={load} />);
  return chrome(<Reports stats={dashboardStats} orders={orders} costumes={costumes} summary={summary} />);
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="admin-page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function AdminButton({ children, variant = "secondary", ...props }) {
  return <button className={`admin-btn ${variant}`} {...props}>{children}</button>;
}

function LoadingState() {
  return <div className="admin-state loading">Đang tải dữ liệu...</div>;
}

function ErrorState({ message, onRetry }) {
  return <div className="admin-state error"><span>{message}</span><AdminButton onClick={onRetry}>Tải lại</AdminButton></div>;
}

function EmptyState({ text = "Chưa có dữ liệu phù hợp." }) {
  return <div className="admin-empty">{text}</div>;
}

function confirmAction(message) {
  return window.confirm(message);
}

function Dashboard({ summary, stats, orders, costumes }) {
  return (
    <>
      <PageHeader title="Tổng quan" subtitle="Theo dõi đơn thuê, doanh thu và tình trạng kho trang phục." />
      <div className="metric-grid">
        <Metric icon={<ClipboardCheck />} label="Tổng đơn thuê" value={summary?.totalOrders || orders.length} />
        <Metric icon={<PackageCheck />} label="Đơn chờ xác nhận" value={summary?.pendingOrders || 0} />
        <Metric icon={<Shirt />} label="Đơn đang thuê" value={stats.renting} />
        <Metric icon={<CreditCard />} label="Doanh thu" value={money(summary?.revenue || 0)} />
        <Metric icon={<CheckCircle2 />} label="Đơn hoàn tất" value={stats.completed} />
        <Metric icon={<CreditCard />} label="Tiền cọc đang giữ" value={money(stats.heldDeposit)} />
        <Metric icon={<Shirt />} label="Trang phục có sẵn" value={stats.available} />
        <Metric icon={<Users />} label="Trang phục đang giặt" value={stats.laundry} />
      </div>
      <div className="admin-two-columns">
        <AdminTable title="Đơn thuê gần đây" rows={orders.slice(0, 6)} columns={["status", "totalRentalPrice", "totalDepositAmount"]} labels={["Trạng thái", "Tiền thuê", "Tiền cọc"]} format={{ totalRentalPrice: money, totalDepositAmount: money }} />
        <AdminTable title="Kho trang phục" rows={costumes.slice(0, 6)} columns={["name", "size", "status"]} labels={["Tên", "Size", "Trạng thái"]} format={{ status: (v) => <StatusBadge type="costume" value={v} /> }} />
      </div>
    </>
  );
}



function CostumeFilterDropdown({
  label,
  value,
  options = [],
  onChange,
  allLabel = "Tất cả"
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const normalizedOptions = [
    ["", allLabel],
    ...asArray(options).filter(
      (option) =>
        Array.isArray(option) &&
        option.length >= 2
    )
  ];

  const selectedOption =
    normalizedOptions.find(
      ([optionValue]) =>
        String(optionValue) ===
        String(value || "")
    ) || normalizedOptions[0];

  useEffect(() => {
    if (!open) return undefined;

    const close = (event) => {
      if (
        !rootRef.current?.contains(
          event.target
        )
      ) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      close
    );

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        close
      );

      window.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`costume-filter-dropdown ${open ? "is-open" : ""
        }`}
    >
      <button
        type="button"
        className="costume-filter-trigger"
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          <small>{label}</small>
          <strong>
            {selectedOption[1]}
          </strong>
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="costume-filter-menu"
          role="listbox"
          aria-label={label}
        >
          {normalizedOptions.map(
            ([optionValue, optionLabel]) => {
              const selected =
                String(optionValue) ===
                String(value || "");

              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={
                    selected
                      ? "is-selected"
                      : ""
                  }
                  key={`${label}-${optionValue || "all"}`}
                  onClick={() => {
                    onChange(optionValue);
                    setOpen(false);
                  }}
                >
                  <span>
                    {optionLabel}
                  </span>

                  {selected && (
                    <CheckCircle2
                      size={15}
                    />
                  )}
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

function AdminCostumes({
  costumes,
  categories,
  brands,
  occasions,
  styles,
  notify,
  reload,
  canManageCatalog,
  canOperateInventory,
  editor
}) {
  const navigate = useNavigate();

  const [search, setSearch] =
    useState("");

  const debouncedSearch =
    useDebouncedValue(search, 600);

  const [filters, setFilters] =
    useState({
      brand: "",
      category: "",
      size: "",
      status: "",
      occasion: "",
      style: ""
    });

  const [sort, setSort] =
    useState("name-asc");

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const [modal, setModal] =
    useState(null);

  useEffect(() => {
    if (editor?.mode === "create") {
      setModal((current) => current?.routeEditor ? current : {
        mode: "create",
        routeEditor: true
      });
      return;
    }

    if (editor?.mode === "edit" && editor.id && costumes.length) {
      const item = findById(costumes, editor.id);
      if (item) {
        setModal((current) => current?.routeEditor && itemId(current.item) === editor.id ? current : {
          mode: "edit",
          item,
          routeEditor: true
        });
      }
    }
  }, [costumes, editor?.id, editor?.mode]);

  const closeCostumeEditor = () => {
    setModal(null);
    if (editor?.mode === "edit" && editor.id) {
      navigate(`/costumes/${editor.id}`);
      return;
    }
    if (editor?.mode === "create") navigate("/costumes");
  };

  const brandOptions = useMemo(
    () =>
      asArray(brands).map((item) => [
        item.slug || item.name,
        item.name
      ]),
    [brands]
  );

  const categoryOptions = useMemo(
    () =>
      asArray(categories).map((item) => [
        itemId(item),
        item.name
      ]),
    [categories]
  );

  const occasionFilterOptions = useMemo(
    () =>
      asArray(occasions).map((item) => [
        item.value || item.slug,
        item.label || item.name
      ]),
    [occasions]
  );

  const styleFilterOptions = useMemo(
    () =>
      asArray(styles).map((item) => [
        item.value || item.slug,
        item.label || item.name
      ]),
    [styles]
  );

  const sizeOptions = [
    ["S", "S"],
    ["M", "M"],
    ["L", "L"],
    ["XL", "XL"],
    ["Freesize", "Freesize"]
  ];

  const sortOptions = [
    ["name-asc", "Tên A → Z"],
    ["name-desc", "Tên Z → A"],
    ["price-asc", "Giá thấp → cao"],
    ["price-desc", "Giá cao → thấp"],
    ["quantity-desc", "Tồn kho nhiều nhất"]
  ];

  const filtered = useMemo(() => {
    const keyword =
      debouncedSearch
        .trim()
        .toLowerCase();

    const result = asArray(costumes).filter(
      (item) => {
        const categoryName =
          item.category?.name ||
          item.categoryId?.name ||
          item.categoryName ||
          "";

        const text = [
          item.name,
          item.brandName,
          categoryName,
          item.color,
          item.size,
          item.skuCode,
          item.occasionName,
          item.styleName,
          getStatusLabel(item.operationalStatus || item.status),
          item.currentDisplayStatus
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (!keyword ||
            text.includes(keyword)) &&
          (!filters.brand ||
            item.brandSlug ===
            filters.brand ||
            item.brandName ===
            filters.brand) &&
          (!filters.category ||
            item.categoryId ===
            filters.category ||
            item.category?._id ===
            filters.category ||
            item.categoryId?._id ===
            filters.category ||
            categoryName ===
            filters.category) &&
          (!filters.size ||
            item.size ===
            filters.size) &&
          (!filters.status ||
            (item.operationalStatus || item.status) ===
            filters.status) &&
          (!filters.occasion ||
            item.occasion ===
            filters.occasion ||
            item.occasionSlug ===
            filters.occasion ||
            asArray(item.occasions).some((entry) => entry.slug === filters.occasion)) &&
          (!filters.style ||
            item.style ===
            filters.style ||
            item.styleSlug ===
            filters.style ||
            asArray(item.styles).some((entry) => entry.slug === filters.style))
        );
      }
    );

    return [...result].sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return String(b.name || "")
            .localeCompare(
              String(a.name || ""),
              "vi"
            );

        case "price-asc":
          return (
            Number(
              a.rentalPricePerDay || 0
            ) -
            Number(
              b.rentalPricePerDay || 0
            )
          );

        case "price-desc":
          return (
            Number(
              b.rentalPricePerDay || 0
            ) -
            Number(
              a.rentalPricePerDay || 0
            )
          );

        case "quantity-desc":
          return (
            Number(b.quantity || 0) -
            Number(a.quantity || 0)
          );

        case "name-asc":
        default:
          return String(a.name || "")
            .localeCompare(
              String(b.name || ""),
              "vi"
            );
      }
    });
  }, [
    costumes,
    debouncedSearch,
    filters,
    sort
  ]);

  const stats = useMemo(
    () => ({
      total: asArray(costumes).length,

      available: asArray(costumes).filter(
        (item) =>
          item.currentDisplayStatus === "available"
      ).length,

      rented: asArray(costumes).filter(
        (item) =>
          item.currentDisplayStatus === "rented"
      ).length,

      laundry: asArray(costumes).filter(
        (item) =>
          item.currentDisplayStatus === "cleaning"
      ).length,

      hidden: asArray(costumes).filter(
        (item) =>
          [
            "maintenance",
            "hidden",
            "unavailable"
          ].includes(item.operationalStatus || item.status)
      ).length
    }),
    [costumes]
  );

  const setFilter = (
    field,
    value
  ) => {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  };

  const resetFilters = () => {
    setSearch("");

    setFilters({
      brand: "",
      category: "",
      size: "",
      status: "",
      occasion: "",
      style: ""
    });

    setSort("name-asc");
  };

  const activeFilterCount =
    Object.values(filters).filter(Boolean)
      .length +
    (search.trim() ? 1 : 0);

  const hasActiveFilters =
    activeFilterCount > 0 ||
    sort !== "name-asc";

  const optionLabel = (
    options,
    value
  ) =>
    asArray(options).find(
      ([optionValue]) =>
        String(optionValue) ===
        String(value)
    )?.[1] || value;

  const activeChips = [
    filters.brand && {
      key: "brand",
      label: optionLabel(
        brandOptions,
        filters.brand
      )
    },

    filters.category && {
      key: "category",
      label: optionLabel(
        categoryOptions,
        filters.category
      )
    },

    filters.size && {
      key: "size",
      label: `Size ${filters.size}`
    },

    filters.status && {
      key: "status",
      label: optionLabel(
        costumeStatusOptions,
        filters.status
      )
    },

    filters.occasion && {
      key: "occasion",
      label: optionLabel(
        occasionFilterOptions,
        filters.occasion
      )
    },

    filters.style && {
      key: "style",
      label: optionLabel(
        styleFilterOptions,
        filters.style
      )
    }
  ].filter(Boolean);

  const save = async (payload, editingId) => {
    const normalized = normalizeCostumeEditorPayload(payload);

    try {
      const response = editingId
        ? await costumeApi.update(
          editingId,
          normalized
        )
        : await costumeApi.create(
          normalized
        );

      notify(
        response.message ||
        (editingId
          ? "Cập nhật trang phục thành công."
          : "Thêm trang phục thành công.")
      );

      setModal(null);
      if (editor?.mode === "edit" && editingId) {
        navigate(`/costumes/${editingId}`);
        return;
      }
      if (editor?.mode === "create") {
        navigate("/costumes");
        return;
      }
      await reload();
    } catch (error) {
      notify(
        error.message ||
        "Không thể lưu trang phục.",
        "error"
      );
    }
  };

  const remove = async (item) => {
    if (
      !confirmAction(
        `Xóa hoặc ẩn trang phục "${item.name}"?`
      )
    ) {
      return;
    }

    const response =
      await costumeApi.remove(
        itemId(item)
      );

    notify(response.message);
    reload();
  };

  const toggle = async (item) => {
    const response =
      await costumeApi.toggleVisibility(
        itemId(item)
      );

    notify(response.message);
    reload();
  };

  const changeStatus = async (
    item,
    status
  ) => {
    const response =
      await costumeApi.updateStatus(
        itemId(item),
        status
      );

    notify(response.message);
    reload();
  };

  return (
    <section className="admin-costume-manager">
      <PageHeader
        title="Quản lý trang phục"
        subtitle="Theo dõi kho, giá thuê, trạng thái và thông tin từng thiết kế."
        action={canManageCatalog ? (
          <AdminButton
            variant="primary"
            onClick={() => setModal({ mode: "create" })}
          >
            <Plus size={16} />
            Thêm trang phục
          </AdminButton>
        ) : null}
      />

      <div className="admin-stat-grid costume-stat-grid">
        <AdminStatCard
          icon={<Shirt />}
          label="Tổng trang phục"
          value={stats.total}
        />

        <AdminStatCard
          icon={<CheckCircle2 />}
          label="Có sẵn"
          value={stats.available}
        />

        <AdminStatCard
          icon={<PackageCheck />}
          label="Đang cho thuê"
          value={stats.rented}
        />

        <AdminStatCard
          icon={<Users />}
          label="Đang giặt"
          value={stats.laundry}
        />

        <AdminStatCard
          icon={<EyeOff />}
          label="Bảo trì / đã ẩn"
          value={stats.hidden}
        />
      </div>

      <div className="admin-card costume-manager-card">
        <div className="costume-manager-toolbar">
          <label className="costume-admin-search">
            <Search
              size={17}
              aria-hidden="true"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Tìm tên, SKU, thương hiệu, màu sắc..."
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                aria-label="Xóa nội dung tìm kiếm"
              >
                <X size={15} />
              </button>
            )}
          </label>

          <button
            type="button"
            className={`costume-filter-toggle ${filtersOpen
              ? "is-open"
              : ""
              }`}
            onClick={() =>
              setFiltersOpen(
                (current) => !current
              )
            }
          >
            <SlidersHorizontal
              size={16}
            />

            Bộ lọc

            {activeFilterCount > 0 && (
              <span>
                {activeFilterCount}
              </span>
            )}
          </button>

          <CostumeFilterDropdown
            label="Sắp xếp"
            value={sort}
            onChange={setSort}
            options={sortOptions}
            allLabel="Tên A → Z"
          />

          <button
            type="button"
            className="costume-filter-reset"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            <RotateCcw size={15} />
            Đặt lại
          </button>
        </div>

        <div
          className={`costume-filter-grid ${filtersOpen
            ? "is-open"
            : ""
            }`}
        >
          <CostumeFilterDropdown
            label="Thương hiệu"
            value={filters.brand}
            onChange={(value) =>
              setFilter(
                "brand",
                value
              )
            }
            options={brandOptions}
            allLabel="Tất cả thương hiệu"
          />

          <CostumeFilterDropdown
            label="Danh mục"
            value={filters.category}
            onChange={(value) =>
              setFilter(
                "category",
                value
              )
            }
            options={categoryOptions}
            allLabel="Tất cả danh mục"
          />

          <CostumeFilterDropdown
            label="Kích thước"
            value={filters.size}
            onChange={(value) =>
              setFilter(
                "size",
                value
              )
            }
            options={sizeOptions}
            allLabel="Tất cả size"
          />

          <CostumeFilterDropdown
            label="Trạng thái"
            value={filters.status}
            onChange={(value) =>
              setFilter(
                "status",
                value
              )
            }
            options={
              costumeStatusOptions
            }
            allLabel="Tất cả trạng thái"
          />

          <CostumeFilterDropdown
            label="Dịp mặc"
            value={filters.occasion}
            onChange={(value) =>
              setFilter(
                "occasion",
                value
              )
            }
            options={
              occasionFilterOptions
            }
            allLabel="Tất cả dịp mặc"
          />

          <CostumeFilterDropdown
            label="Phong cách"
            value={filters.style}
            onChange={(value) =>
              setFilter(
                "style",
                value
              )
            }
            options={
              styleFilterOptions
            }
            allLabel="Tất cả phong cách"
          />
        </div>

        {activeChips.length > 0 && (
          <div className="costume-active-filters">
            <span>Đang lọc:</span>

            {activeChips.map(
              (chip) => (
                <button
                  type="button"
                  key={chip.key}
                  onClick={() =>
                    setFilter(
                      chip.key,
                      ""
                    )
                  }
                >
                  {chip.label}
                  <X size={13} />
                </button>
              )
            )}

            <button
              type="button"
              className="clear-all"
              onClick={resetFilters}
            >
              Xóa tất cả
            </button>
          </div>
        )}

        <div className="costume-result-head">
          <div>
            <span>
              COSTUME INVENTORY
            </span>

            <h2>
              Danh sách trang phục
            </h2>
          </div>

          <p>
            Hiển thị{" "}
            <strong>
              {filtered.length}
            </strong>{" "}
            trên {stats.total} sản phẩm
          </p>
        </div>

        <div className="costume-table-shell">
          <AdminTable
            tableClassName="costume-table costume-table-compact"
            mobileCards
            rows={filtered}
            columns={[
              "name",
              "classification",
              "pricing",
              "quantity",
              "status"
            ]}
            labels={[
              "Trang phục",
              "Phân loại",
              "Giá & cọc",
              "Tồn kho",
              "Trạng thái"
            ]}
            colWidths={[
              "",
              "150px",
              "140px",
              "90px",
              "172px",
              "84px"
            ]}
            columnClasses={{
              name: "clamp-cell",
              classification:
                "classification-cell",
              pricing: "pricing-cell",
              quantity:
                "numeric-cell",
              status: "status-cell"
            }}
            format={{
              name: (value, row) => (
                <span className="costume-product-cell">
                  <img
                    className="admin-thumb costume-admin-thumb"
                    src={resolveImageUrl(row.image || row.images?.[0])}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = "/placeholder.png";
                    }}
                  />
                  <span className="costume-name-cell">
                    <strong>{value || "Chưa đặt tên"}</strong>
                    <small>{[
                      row.skuCode && `SKU: ${row.skuCode}`,
                      row.size && `Size: ${row.size}`,
                      row.color && `Màu: ${row.color}`
                    ].filter(Boolean).join(" · ") || "Chưa có thông tin phụ"}</small>
                  </span>
                </span>
              ),

              classification: (
                _,
                row
              ) => (
                <span className="costume-classification-cell">
                  <strong>
                    {row.brandName ||
                      "Chưa có thương hiệu"}
                  </strong>

                  <small>
                    {row.category?.name ||
                      row.categoryId
                        ?.name ||
                      row.categoryName ||
                      "Chưa có danh mục"}
                  </small>
                </span>
              ),

              pricing: (_, row) => (
                <span className="costume-pricing-cell">
                  <strong>
                    {money(
                      row.rentalPricePerDay
                    )}
                  </strong>

                  <small>
                    Tiền cọc ·{" "}
                    {money(
                      row.depositAmount
                    )}
                  </small>
                </span>
              ),

              quantity: (value) => (
                <span className="costume-stock-cell">
                  <strong className="costume-stock-value">{Number(value || 0)}</strong>
                  <small>sản phẩm</small>
                </span>
              ),

              status: (_, row) => (
                <span className="costume-status-stack">
                  <span className="costume-status-row">
                    {canOperateInventory ? (
                      <AdminSelect
                        value={row.operationalStatus || (row.status === "available" ? "active" : row.status)}
                        options={costumeStatusOptions}
                        onChange={(value) => changeStatus(row, value)}
                      />
                    ) : <strong>{getStatusLabel(row.operationalStatus || row.status)}</strong>}
                  </span>
                  <AdminStatusBadge type="costume" value={row.currentDisplayStatus || "available"} />
                  {row.currentStatusUntil && <small>Đến {formatDateTime(row.currentStatusUntil)}</small>}
                </span>
              )
            }}
            actions={(row) => (
              <AdminActionMenu>
                <AdminButton
                  onClick={() =>
                    navigate(
                      `/costumes/${itemId(
                        row
                      )}`
                    )
                  }
                >
                  <Eye size={14} />
                  Xem
                </AdminButton>

                {canManageCatalog && <AdminButton onClick={() => setModal({ mode: "edit", item: row })}>
                  <Pencil size={14} /> Sửa
                </AdminButton>}

                {false && (<>
                <AdminButton
                  onClick={() => {
                    const next =
                      (row.operationalStatus || row.status) ===
                        "active"
                        ? "maintenance"
                        : "active";

                    if (
                      window.confirm(
                        `Đổi trạng thái trang phục sang "${getStatusLabel(
                          next
                        )}"?`
                      )
                    ) {
                      changeStatus(
                        row,
                        next
                      );
                    }
                  }}
                >
                  Đổi trạng thái
                </AdminButton>

                <AdminButton
                  onClick={() =>
                    toggle(row)
                  }
                >
                  {(row.operationalStatus || row.status) ===
                    "hidden" ? (
                    <Eye size={14} />
                  ) : (
                    <EyeOff size={14} />
                  )}

                  {(row.operationalStatus || row.status) ===
                    "hidden"
                    ? "Hiện"
                    : "Ẩn"}
                </AdminButton>

                </>)}

                {canManageCatalog && <AdminButton
                  variant="danger"
                  onClick={() =>
                    remove(row)
                  }
                >
                  <Trash2 size={14} />
                  Xóa
                </AdminButton>}
              </AdminActionMenu>
            )}
          />
        </div>
      </div>

      {modal?.mode === "view" && (
        <CostumeDetailModal
          item={modal.item}
          onClose={() =>
            setModal(null)
          }
        />
      )}

      {["create", "edit"].includes(
        modal?.mode
      ) && (
          <CostumeFormModal
            title={
              modal.mode === "edit"
                ? "Sửa trang phục"
                : "Thêm trang phục"
            }
            initial={modal.item}
            categories={categories}
            brands={brands}
            occasions={occasions}
            styles={styles}
            notify={notify}
            onClose={closeCostumeEditor}
            onSave={save}
          />
        )}
    </section>
  );
}

function LegacyMoneyThousandsInput({
  label,
  value,
  onChange,
  required = false
}) {
  const numericValue = Number(value);

  const displayedValue =
    value === "" ||
      value === undefined ||
      value === null
      ? ""
      : Number.isFinite(numericValue)
        ? String(Math.round(numericValue / 1000))
        : "";

  const handleChange = (event) => {
    const digits =
      event.target.value.replace(/\D/g, "");

    onChange(
      digits === ""
        ? ""
        : Number(digits) * 1000
    );
  };

  return (
    <label className="admin-money-input-field">
      <span>{label}</span>

      <div className="admin-money-input-control">
        <input
          required={required}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={displayedValue}
          placeholder="Ví dụ: 700"
          onFocus={(event) =>
            event.currentTarget.select()
          }
          onChange={handleChange}
        />

        <span className="admin-money-input-suffix">
          .000 đ
        </span>
      </div>

      {displayedValue && (
        <small>
          Thành tiền:{" "}
          {money(Number(displayedValue) * 1000)}
        </small>
      )}
    </label>
  );
}

function LegacyModalSelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = "Chọn một giá trị",
  disabled = false,
  clearable = false
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});

  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const normalizedOptions = useMemo(
    () =>
      asArray(options)
        .map((option) => {
          if (Array.isArray(option)) {
            return {
              value: option[0],
              label: option[1]
            };
          }

          return {
            value: option?.value,
            label: option?.label || option?.name
          };
        })
        .filter(
          (option) =>
            option.value !== undefined &&
            option.value !== null &&
            option.label
        ),
    [options]
  );

  const selectedOption = normalizedOptions.find(
    (option) =>
      String(option.value) ===
      String(value ?? "")
  );

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const gap = 6;
      const viewportPadding = 12;
      const spaceBelow =
        window.innerHeight - rect.bottom - gap - viewportPadding;
      const spaceAbove = rect.top - gap - viewportPadding;
      const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
      const availableSpace = openUp ? spaceAbove : spaceBelow;
      const width = Math.min(
        rect.width,
        window.innerWidth - viewportPadding * 2
      );
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding
      );

      setMenuStyle({
        position: "fixed",
        left,
        width,
        maxHeight: Math.min(
          320,
          Math.max(160, availableSpace)
        ),
        top: openUp ? "auto" : rect.bottom + gap,
        bottom: openUp
          ? window.innerHeight - rect.top + gap
          : "auto"
      });
    };

    const closeOutside = (event) => {
      const clickedRoot = rootRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);

      if (!clickedRoot && !clickedMenu) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    updatePosition();

    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const selectValue = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="modal-select-field"
    >
      <span className="modal-select-label">
        {label}
      </span>

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={[
          "modal-select-trigger",
          open ? "is-open" : "",
          !selectedOption ? "is-placeholder" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() =>
          setOpen((current) => !current)
        }
      >
        <span>
          {selectedOption?.label || placeholder}
        </span>

        <ChevronDown
          size={17}
          aria-hidden="true"
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="modal-select-menu"
            style={menuStyle}
            aria-label={label}
          >
            {clearable && (
              <button
                type="button"
                role="option"
                aria-selected={!selectedOption}
                className={!selectedOption ? "is-selected" : ""}
                onClick={() => selectValue("")}
              >
                <span>{placeholder}</span>

                {!selectedOption && (
                  <CheckCircle2 size={16} />
                )}
              </button>
            )}

            {normalizedOptions.map((option) => {
              const selected =
                String(option.value) ===
                String(value ?? "");

              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? "is-selected" : ""}
                  onClick={() => selectValue(option.value)}
                >
                  <span>{option.label}</span>

                  {selected && (
                    <CheckCircle2 size={16} />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

export function CostumeFormModal({
  title,
  initial,
  categories = [],
  brands = [],
  occasions = fallbackOccasionOptions,
  styles = fallbackStyleOptions,
  notify,
  onClose,
  onSave
}) {
  const formId = "admin-costume-editor-form";
  const categoryOptions = asArray(categories);
  const brandOptions = asArray(brands);

  const resolveBrandSlug = (item) => {
    if (!item) return "";
    if (item.brandSlug) return item.brandSlug;

    const brandId =
      typeof item.brandId === "object"
        ? item.brandId?._id
        : item.brandId;

    const brandName =
      item.brandName ||
      item.brand?.name ||
      item.brandId?.name ||
      "";

    const match = brandOptions.find((brand) => {
      const id = itemId(brand);

      return (
        id === brandId ||
        brand.slug === item.brand?.slug ||
        brand.slug === item.brandId?.slug ||
        brand.name === brandName
      );
    });

    return match?.slug || "";
  };

  const empty = {
    name: "",
    description: "",
    brandSlug: "",
    categoryId: "",
    size: "M",
    color: "",
    occasionIds: [],
    styleIds: [],
    material: "",
    originalPrice: "",
    rentalPricePerDay: "",
    memberPrice: "",
    depositAmount: "",
    quantity: 1,
    skuCode: "",
    image: "",
    imagePublicId: "",
    images: [],
    imageAssets: [],
    operationalStatus: "active",
    cleaningDurationMinutes: 180,
    accessories: "",
    conditionNote: ""
  };

  const classificationIds = (item, type, options) => {
    const idsField = `${type}Ids`;
    const valuesField = `${type}s`;
    const direct = asArray(item?.[idsField]).map((value) => itemId(value) || value).filter(Boolean);
    if (direct.length) return direct;
    const expanded = asArray(item?.[valuesField]).map((value) => itemId(value) || value?.id).filter(Boolean);
    if (expanded.length) return expanded;
    const legacy = item?.[`${type}Slug`] || item?.[type];
    const match = asArray(options).find((option) => option.slug === legacy || option.value === legacy);
    return match ? [itemId(match)] : [];
  };

  const [form, setForm] = useState(() => ({
    ...empty,
    ...initial,
    operationalStatus: initial?.operationalStatus || ({ available: "active", washing: "active", laundry: "active", repairing: "maintenance" }[initial?.status] || initial?.status || "active"),
    categoryId:
      initial?.categoryId?._id ||
      initial?.categoryId ||
      initial?.category?.id ||
      initial?.category?._id ||
      "",
    brandSlug: resolveBrandSlug(initial),
    occasionIds: classificationIds(initial, "occasion", occasions),
    styleIds: classificationIds(initial, "style", styles),
    image: initial?.image || (typeof initial?.images?.[0] === "string" ? initial.images[0] : initial?.images?.[0]?.url) || "",
    imageAssets: (initial?.imageAssets?.length ? initial.imageAssets : initial?.images || [initial?.image].filter(Boolean)).map((item, index) => typeof item === "string" ? { url: item, publicId: item === initial?.image ? initial?.imagePublicId || "" : "", alt: "", sortOrder: index } : { ...item, sortOrder: index }),
    images: (initial?.images || [initial?.image].filter(Boolean)).map((item) => typeof item === "string" ? item : item?.url).filter(Boolean)
  }));

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const manuallyEditedClassification = useRef({ occasionIds: false, styleIds: false });

  const occasionSelectOptions =
    asArray(occasions).length
      ? asArray(occasions)
      : fallbackOccasionOptions;

  const styleSelectOptions =
    asArray(styles).length
      ? asArray(styles)
      : fallbackStyleOptions;

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateClassification = (field, value) => {
    manuallyEditedClassification.current[field] = true;
    update(field, value);
  };

  const updateCategory = (value) => {
    const category = categoryOptions.find((item) => itemId(item) === value);
    setForm((current) => ({
      ...current,
      categoryId: value,
      ...(!initial && !manuallyEditedClassification.current.occasionIds
        ? { occasionIds: asArray(category?.defaultOccasionIds).map((item) => itemId(item) || item).filter(Boolean) }
        : {}),
      ...(!initial && !manuallyEditedClassification.current.styleIds
        ? { styleIds: asArray(category?.defaultStyleIds).map((item) => itemId(item) || item).filter(Boolean) }
        : {})
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || uploading) return;

    if (!form.name || !form.brandSlug || !form.categoryId) {
      notify(
        "Vui lòng nhập đủ tên, thương hiệu và danh mục.",
        "error"
      );
      return;
    }

    if (
      form.rentalPricePerDay === "" ||
      form.depositAmount === ""
    ) {
      notify(
        "Vui lòng nhập giá thuê và tiền cọc.",
        "error"
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(
        form,
        initial ? itemId(initial) : null
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={title}
      onClose={onClose}
      className="costume-form-modal"
      footer={
        <>
          <AdminButton
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </AdminButton>

          <AdminButton
            type="submit"
            form={formId}
            variant="primary"
            disabled={uploading || saving}
          >
            {saving
              ? "Đang lưu..."
              : initial
                ? "Lưu thay đổi"
                : "Tạo trang phục"}
          </AdminButton>
        </>
      }
    >
      <form
        id={formId}
        className="admin-form"
        onSubmit={submit}
      >
        <fieldset className="form-section">
          <legend>Thông tin cơ bản</legend>

          <div className="form-grid">
            <label>
              <span>Tên trang phục</span>
              <input
                required
                value={form.name}
                onChange={(event) =>
                  update("name", event.target.value)
                }
              />
            </label>

            <label>
              <span>SKU</span>
              <input
                value={form.skuCode}
                readOnly
                placeholder="Tự động tạo sau khi lưu"
              />
              <small>Hệ thống tự tạo SKU duy nhất cho trang phục.</small>
            </label>

            <label>
              <span>Chất liệu</span>
              <input
                value={form.material}
                onChange={(event) =>
                  update("material", event.target.value)
                }
              />
            </label>
          </div>

          <label>
            <span>Mô tả</span>
            <textarea
              required
              value={form.description}
              onChange={(event) =>
                update("description", event.target.value)
              }
            />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Phân loại</legend>

          <div className="form-grid">
            <ModalSelect
              label="Thương hiệu"
              value={form.brandSlug}
              placeholder="Chọn thương hiệu"
              options={brandOptions.map((brand) => ({
                value: brand.slug,
                label: brand.name
              }))}
              onChange={(value) =>
                update("brandSlug", value)
              }
            />

            <ModalSelect
              label="Danh mục"
              value={form.categoryId}
              placeholder="Chọn danh mục"
              options={categoryOptions.map((category) => ({
                value: itemId(category),
                label: category.name
              }))}
              onChange={updateCategory}
            />

            <ModalMultiSelect
              label="Dịp mặc"
              value={form.occasionIds}
              placeholder="Chọn các dịp mặc"
              options={occasionSelectOptions.map((item) => ({
                value: itemId(item),
                label: item.label || item.name
              })).filter((item) => item.value)}
              onChange={(value) => updateClassification("occasionIds", value)}
            />

            <ModalMultiSelect
              label="Phong cách"
              value={form.styleIds}
              placeholder="Chọn các phong cách"
              options={styleSelectOptions.map((item) => ({
                value: itemId(item),
                label: item.label || item.name
              })).filter((item) => item.value)}
              onChange={(value) => updateClassification("styleIds", value)}
            />

            <label>
              <span>Size</span>
              <input
                required
                value={form.size}
                onChange={(event) =>
                  update("size", event.target.value)
                }
              />
            </label>

            <label>
              <span>Màu sắc</span>
              <input
                required
                value={form.color}
                onChange={(event) =>
                  update("color", event.target.value)
                }
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Giá thuê</legend>

          <div className="form-grid">
            <MoneyThousandsInput
              label="Giá gốc"
              value={form.originalPrice}
              onChange={(value) =>
                update("originalPrice", value)
              }
            />

            <MoneyThousandsInput
              label="Giá thuê"
              value={form.rentalPricePerDay}
              required
              onChange={(value) =>
                update("rentalPricePerDay", value)
              }
            />

            <MoneyThousandsInput
              label="Giá member"
              value={form.memberPrice}
              onChange={(value) =>
                update("memberPrice", value)
              }
            />

            <MoneyThousandsInput
              label="Tiền cọc"
              value={form.depositAmount}
              required
              onChange={(value) =>
                update("depositAmount", value)
              }
            />

            <label>
              <span>Số lượng</span>

              <input
                type="text"
                inputMode="numeric"
                value={form.quantity}
                onFocus={(event) =>
                  event.currentTarget.select()
                }
                onChange={(event) => {
                  const digits =
                    event.target.value.replace(/\D/g, "");

                  update(
                    "quantity",
                    digits === "" ? "" : Number(digits)
                  );
                }}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Hình ảnh</legend>

          <MultiImageUploader label="Ảnh trang phục" value={form.imageAssets} max={10} primaryUrl={form.image} notify={notify} onUploadingChange={setUploading} onChange={(assets) => setForm((current) => ({ ...current, imageAssets: assets, images: assets.map((asset) => asset.url), image: assets.some((asset) => asset.url === current.image) ? current.image : assets[0]?.url || "", imagePublicId: (assets.find((asset) => asset.url === (assets.some((item) => item.url === current.image) ? current.image : assets[0]?.url))?.publicId) || "" }))} onPrimaryChange={(url) => setForm((current) => { const asset = current.imageAssets.find((item) => item.url === url); return { ...current, image: url, imagePublicId: asset?.publicId || "" }; })} />
        </fieldset>

        <fieldset className="form-section">
          <legend>Trạng thái/Ghi chú</legend>

          <div className="form-grid">
            <ModalSelect
              label="Trạng thái vận hành"
              value={form.operationalStatus}
              placeholder="Chọn trạng thái vận hành"
              options={costumeStatusOptions}
              onChange={(value) =>
                update("operationalStatus", value)
              }
            />
            <PlainNumberInput
              label="Thời gian vệ sinh (phút)"
              value={form.cleaningDurationMinutes}
              min={0}
              onChange={(value) => update("cleaningDurationMinutes", value)}
            />
          </div>

          <label>
            <span>Phụ kiện đi kèm</span>
            <textarea
              value={form.accessories}
              onChange={(event) =>
                update("accessories", event.target.value)
              }
            />
          </label>

          <label>
            <span>Ghi chú tình trạng</span>
            <textarea
              value={form.conditionNote}
              onChange={(event) =>
                update("conditionNote", event.target.value)
              }
            />
          </label>
        </fieldset>

      </form>
    </AdminModal>
  );
}

function CostumeDetailModal({ item, onClose }) {
  const detailRows = [
    ["Thương hiệu", item.brandName],
    ["Danh mục", item.category?.name || item.categoryId?.name],
    ["Size", item.size],
    ["Màu sắc", item.color],
    ["Dịp mặc", asArray(item.occasions).map((entry) => entry.name).filter(Boolean).join(", ") || item.occasionName || item.occasion],
    ["Phong cách", asArray(item.styles).map((entry) => entry.name).filter(Boolean).join(", ") || item.styleName || item.style],
    ["Chất liệu", item.material],
    ["Giá thuê", money(item.rentalPricePerDay)],
    ["Tiền cọc", money(item.depositAmount)],
    ["Số lượng", item.quantity],
    ["SKU", item.skuCode],
    ["Trạng thái vận hành", getStatusLabel(item.operationalStatus || item.status)],
    ["Trạng thái lịch", item.currentDisplayStatus],
    ["Trạng thái đến", item.currentStatusUntil ? formatDateTime(item.currentStatusUntil) : "-"],
    ["Có thể nhận lịch từ", item.nextAvailableAt ? formatDateTime(item.nextAvailableAt) : "-"]
  ];

  return (
    <AdminModal title="Chi tiết trang phục" onClose={onClose}>
      <div className="admin-costume-detail">
        <div className="admin-detail-media">
          <img className="detail-image" src={resolveImageUrl(item.image || item.images?.[0])} alt={item.name} onError={(event) => { event.currentTarget.src = "/placeholder.png"; }} />
        </div>
        <div className="admin-detail-content">
          <div className="admin-detail-title">
            <StatusBadge type="costume" value={item.currentDisplayStatus || item.operationalStatus || item.status} />
            <h3>{item.name}</h3>
            <p>{item.description || "Chưa có mô tả chi tiết."}</p>
          </div>
          <div className="admin-detail-list">
            {detailRows.map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span>{label}</span>
                <strong>{value || "-"}</strong>
              </div>
            ))}
          </div>
          {(item.accessories || item.conditionNote) && (
            <div className="admin-detail-note">
              {item.accessories && <p><strong>Phụ kiện:</strong> {item.accessories}</p>}
              {item.conditionNote && <p><strong>Ghi chú tình trạng:</strong> {item.conditionNote}</p>}
            </div>
          )}
        </div>
      </div>
    </AdminModal>
  );
}

function TaxonomyManager({ title, noun, items, notify, reload, createItem, updateItem, deleteItem, toggleItem, showIcon = false, defaultOptions = null }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 600);
  const [modal, setModal] = useState(null);
  const filtered = items.filter((item) => [item.name, item.slug, item.description, getStatusLabel(item.status)].join(" ").toLowerCase().includes(debouncedSearch.toLowerCase()));

  const save = async (payload, editingId) => {
    const response = editingId ? await updateItem(editingId, payload) : await createItem(payload);
    notify(response.message);
    setModal(null);
    reload();
  };
  const remove = async (item) => {
    if (!confirmAction(`Xóa hoặc ẩn ${noun} "${item.name}"?`)) return;
    const response = await deleteItem(itemId(item));
    notify(response.message);
    reload();
  };
  const toggle = async (item) => {
    const response = await toggleItem(itemId(item));
    notify(response.message);
    reload();
  };

  return (
    <>
      <PageHeader title={title} subtitle={`Quản lý danh sách ${noun}, trạng thái hiển thị và dữ liệu dùng cho trang phục.`} action={<AdminButton variant="primary" onClick={() => setModal({})}><Plus size={16} /> Thêm mới</AdminButton>} />
      <div className="admin-card">
        <div className="admin-toolbar admin-toolbar--search-only">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm ${noun}...`}
          />
        </div>
        <AdminTable
          rows={filtered}
          columns={defaultOptions ? ["name", "slug", "defaultOccasionIds", "defaultStyleIds", "description", "status"] : showIcon ? ["name", "slug", "icon", "description", "status"] : ["name", "slug", "description", "status"]}
          labels={defaultOptions ? ["Tên", "Slug", "Dịp mặc mặc định", "Phong cách mặc định", "Mô tả", "Trạng thái"] : showIcon ? ["Tên", "Slug", "Icon", "Mô tả", "Trạng thái"] : ["Tên", "Slug", "Mô tả", "Trạng thái"]}
          format={{
            status: (v) => <StatusBadge value={v} />,
            defaultOccasionIds: (value, row) => asArray(value).map((item) => item.name).filter(Boolean).join(", ") || row.defaultOccasionName || "-",
            defaultStyleIds: (value, row) => asArray(value).map((item) => item.name).filter(Boolean).join(", ") || row.defaultStyleName || "-"
          }}
          actions={(row) => (
            <>
              <AdminButton onClick={() => setModal({ item: row })}><Pencil size={14} /> Sửa</AdminButton>
              <AdminButton onClick={() => toggle(row)}>{row.status === "active" ? "Ẩn" : "Hiện"}</AdminButton>
              <AdminButton variant="danger" onClick={() => remove(row)}><Trash2 size={14} /> Xóa</AdminButton>
            </>
          )}
        />
      </div>
      {modal && <TaxonomyForm title={modal.item ? `Sửa ${noun}` : `Thêm ${noun}`} initial={modal.item} showIcon={showIcon} defaultOptions={defaultOptions} onClose={() => setModal(null)} onSave={save} />}
    </>
  );
}

function TaxonomyForm({ title, initial, showIcon, defaultOptions, onClose, onSave }) {
  const initialDefaultIds = (type) => {
    const values = asArray(initial?.[`default${type}Ids`]).map((item) => itemId(item) || item).filter(Boolean);
    if (values.length) return values;
    const legacySlug = initial?.[`default${type}Slug`];
    const options = asArray(type === "Occasion" ? defaultOptions?.occasions : defaultOptions?.styles);
    const match = options.find((item) => item.slug === legacySlug);
    return match ? [itemId(match)] : [];
  };
  const [form, setForm] = useState({ name: initial?.name || "", slug: initial?.slug || "", description: initial?.description || "", icon: initial?.icon || "", status: initial?.status || "active", defaultOccasionIds: initialDefaultIds("Occasion"), defaultStyleIds: initialDefaultIds("Style") });
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <AdminModal title={title} onClose={onClose} className="taxonomy-form-modal">
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); onSave(form, initial ? itemId(initial) : null); }}>
        <div className="form-grid">
          <label>Tên<input required value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
          <label>Slug<input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="Tự tạo từ tên nếu bỏ trống" /></label>
          {showIcon && <label>Icon<input value={form.icon} onChange={(e) => update("icon", e.target.value)} /></label>}
          {defaultOptions && <ModalMultiSelect label="Dịp mặc mặc định" value={form.defaultOccasionIds} placeholder="Không có" options={asArray(defaultOptions.occasions).map((item) => ({ value: itemId(item), label: item.name || item.label })).filter((item) => item.value)} onChange={(value) => update("defaultOccasionIds", value)} />}
          {defaultOptions && <ModalMultiSelect label="Phong cách mặc định" value={form.defaultStyleIds} placeholder="Không có" options={asArray(defaultOptions.styles).map((item) => ({ value: itemId(item), label: item.name || item.label })).filter((item) => item.value)} onChange={(value) => update("defaultStyleIds", value)} />}
          <ModalSelect label="Trạng thái" value={form.status} onChange={(value) => update("status", value)} options={[["active", "Đang hiển thị"], ["inactive", "Đã ẩn"]]} />
        </div>
        <label>Mô tả<textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
        <div className="modal-actions"><AdminButton type="button" onClick={onClose}>Hủy</AdminButton><AdminButton type="submit" variant="primary">Lưu</AdminButton></div>
      </form>
    </AdminModal>
  );
}

function VoucherManager({ items, notify, reload }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 600);
  const [modal, setModal] = useState(null);
  const filtered = items.filter((item) => [item.code, item.name, getStatusLabel(item.status)].join(" ").toLowerCase().includes(debouncedSearch.toLowerCase()));
  const save = async (payload, editingId) => {
    if (payload.discountType === "percent" && (Number(payload.discountValue) < 1 || Number(payload.discountValue) > 100)) return notify("Giảm phần trăm phải từ 1 đến 100.", "error");
    if (payload.endDate && payload.startDate && payload.endDate <= payload.startDate) return notify("Ngày kết thúc phải sau ngày bắt đầu.", "error");
    const response = editingId ? await updateVoucher(editingId, payload) : await createVoucher(payload);
    notify(response.message);
    setModal(null);
    reload();
  };
  const remove = async (item) => {
    if (!confirmAction(`Xóa voucher "${item.code}"?`)) return;
    const response = await removeVoucher(itemId(item));
    notify(response.message);
    reload();
  };
  return (
    <>
      <PageHeader title="Quản lý voucher" subtitle="Tạo, chỉnh sửa, bật tắt và kiểm soát hiệu lực voucher." action={<AdminButton variant="primary" onClick={() => setModal({})}><Plus size={16} /> Thêm voucher</AdminButton>} />
      <div className="admin-card">
        <div className="admin-toolbar admin-toolbar--search-only">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm mã voucher, tên voucher..."
          />
        </div>
        <AdminTable rows={filtered} columns={["code", "name", "discountType", "discountValue", "usage", "status"]} labels={["Code", "Tên", "Loại giảm", "Giá trị", "Đã dùng/Giới hạn", "Trạng thái"]} format={{ usage: (_, row) => `${row.usedCount || 0}/${row.usageLimit || "∞"}`, status: (v) => <StatusBadge value={v} /> }} actions={(row) => <><AdminButton onClick={() => setModal({ item: row })}><Pencil size={14} /> Sửa</AdminButton><AdminButton onClick={async () => { const res = await toggleVoucherStatus(itemId(row)); notify(res.message); reload(); }}>{row.status === "active" ? "Tắt" : "Bật"}</AdminButton><AdminButton variant="danger" onClick={() => remove(row)}><Trash2 size={14} /> Xóa</AdminButton></>} />
      </div>
      {modal && <VoucherForm initial={modal.item} onClose={() => setModal(null)} onSave={save} />}
    </>
  );
}

function VoucherForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ code: initial?.code || "", name: initial?.name || "", description: initial?.description || "", discountType: initial?.discountType || "percent", discountValue: initial?.discountValue ?? "", minOrderValue: initial?.minOrderValue ?? "", maxDiscount: initial?.maxDiscount ?? "", usageLimit: initial?.usageLimit ?? "", startDate: String(initial?.startDate || "").slice(0, 10), endDate: String(initial?.endDate || "").slice(0, 10), status: initial?.status || "active" });
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const nextDate = form.startDate ? (() => { const date = new Date(`${form.startDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); })() : undefined;
  return (
    <AdminModal title={initial ? "Sửa voucher" : "Thêm voucher"} onClose={onClose}>
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); onSave(form, initial ? itemId(initial) : null); }}>
        <div className="form-grid">
          <label>Mã voucher<input required value={form.code} onChange={(e) => update("code", e.target.value.toUpperCase())} /></label>
          <label>Tên voucher<input required value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
          <ModalSelect label="Loại giảm" value={form.discountType} onChange={(value) => update("discountType", value)} options={[["percent", "Phần trăm"], ["fixed", "Số tiền"]]} />
          {form.discountType === "percent" ? <PlainNumberInput label="Giá trị giảm" value={form.discountValue} min={1} max={100} suffix="%" onChange={(value) => update("discountValue", value)} /> : <MoneyThousandsInput label="Giá trị giảm" value={form.discountValue} onChange={(value) => update("discountValue", value)} />}
          <MoneyThousandsInput label="Đơn tối thiểu" value={form.minOrderValue} onChange={(value) => update("minOrderValue", value)} />
          <MoneyThousandsInput label="Giảm tối đa" value={form.maxDiscount} onChange={(value) => update("maxDiscount", value)} />
          <PlainNumberInput label="Số lượt dùng" value={form.usageLimit} min={0} onChange={(value) => update("usageLimit", value)} />
          <ModalDatePicker label="Ngày bắt đầu" value={form.startDate} onChange={(value) => update("startDate", value)} />
          <ModalDatePicker label="Ngày kết thúc" value={form.endDate} minDate={nextDate} onChange={(value) => update("endDate", value)} />
          <ModalSelect label="Trạng thái" value={form.status} onChange={(value) => update("status", value)} options={[["active", "Đang hiển thị"], ["inactive", "Đã ẩn"], ["expired", "Hết hiệu lực"]]} />
        </div>
        <label>Mô tả<textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
        <div className="modal-actions"><AdminButton type="button" onClick={onClose}>Hủy</AdminButton><AdminButton type="submit" variant="primary">Lưu</AdminButton></div>
      </form>
    </AdminModal>
  );
}

function BannerManager({ items, notify, reload }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 600);
  const [modal, setModal] = useState(null);
  const runAction = async (action) => {
    try {
      const response = await action();
      notify(response?.message || "Cập nhật banner thành công.");
      await reload();
    } catch (error) {
      notify(error?.message || "Không thể cập nhật banner.", "error");
    }
  };
  const filtered = items.filter((item) => [item.title, item.subtitle, item.position, getStatusLabel(item.status)].join(" ").toLowerCase().includes(debouncedSearch.toLowerCase()));
  const save = async (payload, editingId) => {
    const response = editingId ? await updateBanner(editingId, payload) : await createBanner(payload);
    notify(response.message);
    setModal(null);
    reload();
  };
  const remove = async (item) => {
    if (!confirmAction(`Xóa banner "${item.title}"?`)) return;
    await runAction(() => removeBanner(itemId(item)));
  };
  return (
    <>
      <PageHeader title="Quản lý banner" subtitle="Quản lý banner chính, banner phụ và thư viện ảnh theo từng vị trí." action={<AdminButton variant="primary" onClick={() => setModal({})}><Plus size={16} /> Thêm banner</AdminButton>} />
      <div className="admin-card">
        <div className="admin-toolbar admin-toolbar--search-only">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tiêu đề, nội dung, vị trí banner..."
          />
        </div> <AdminTable
          tableClassName="banner-table"
          rows={filtered}
          columns={["image", "imageCount", "title", "subtitle", "buttonText", "buttonLink", "position", "sortOrder", "status", "role"]}
          labels={["Ảnh", "Số ảnh", "Tiêu đề", "Mô tả", "Nút", "Link", "Vị trí", "Thứ tự", "Trạng thái", "Vai trò"]}
          colWidths={["64px", "62px", "132px", "", "82px", "96px", "64px", "56px", "104px", "104px", "306px"]}
          columnClasses={{
            title: "clamp-cell",
            subtitle: "clamp-cell",
            buttonText: "clamp-cell",
            buttonLink: "clamp-cell",
            position: "numeric-cell",
            sortOrder: "numeric-cell",
            status: "status-cell"
          }}
          format={{
            image: (_, row) => <img className="admin-thumb wide" src={resolveImageUrl(row.image)} alt={row.title} onError={(event) => { event.currentTarget.src = "/placeholder.png"; }} />,
            imageCount: (_, row) => `${row.images?.length || (row.image ? 1 : 0)} ảnh`,
            status: (value) => <StatusBadge value={value} />,
            role: (_, row) => <span className={`banner-role-badge ${row.status !== "active" ? "is-hidden" : row.isPrimary ? "is-primary" : "is-secondary"}`}>{row.status !== "active" ? "Đã ẩn" : row.isPrimary ? "Banner chính" : "Banner phụ"}</span>
          }}
          actions={(row) => <><AdminButton onClick={() => setModal({ item: row })}><Pencil size={14} /> Sửa</AdminButton><AdminButton onClick={() => runAction(() => toggleBannerStatus(itemId(row)))}>{row.status === "active" ? "Ẩn" : "Hiện"}</AdminButton>{row.isPrimary ? <AdminButton disabled>Đang là chính</AdminButton> : <AdminButton onClick={() => runAction(() => setPrimaryBanner(itemId(row)))}>Đặt làm chính</AdminButton>}<AdminButton variant="danger" onClick={() => remove(row)}><Trash2 size={14} /> Xóa</AdminButton></>}
        />
      </div>
      {modal && <BannerForm initial={modal.item} notify={notify} onClose={() => setModal(null)} onSave={save} />}
    </>
  );
}

function BannerForm({ initial, notify, onClose, onSave }) {
  const initialAssets = initial?.images?.length ? initial.images : initial?.image ? [{ url: initial.image, publicId: initial.imagePublicId || "", alt: initial.title || "", sortOrder: 0 }] : [];
  const [form, setForm] = useState({ title: initial?.title || "", subtitle: initial?.subtitle || "", buttonText: initial?.buttonText || "", buttonLink: initial?.buttonLink || initial?.link || "/costumes", position: initial?.position || "hero", sortOrder: initial?.sortOrder ?? 1, status: initial?.status || "active", image: initial?.image || initialAssets[0]?.url || "", imagePublicId: initial?.imagePublicId || initialAssets[0]?.publicId || "", imageAssets: initialAssets });
  const [uploading, setUploading] = useState(false);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.imageAssets.length) return notify("Banner cần ít nhất một hình ảnh.", "error");
    setUploading(true);
    try {
      const pending = form.imageAssets.filter((asset) => asset.file);
      const uploaded = pending.length ? (await uploadImages(pending.map((asset) => asset.file))).images || [] : [];
      let uploadIndex = 0;
      const images = form.imageAssets.map((asset, index) => {
        const saved = asset.file ? uploaded[uploadIndex++] : asset;
        return { url: saved?.url || "", publicId: saved?.publicId || "", alt: asset.alt || form.title, sortOrder: index };
      }).filter((asset) => asset.url && !asset.url.startsWith("blob:"));
      if (images.length !== form.imageAssets.length) throw new Error("Có ảnh chưa được tải lên thành công. Vui lòng thử lại.");
      const selectedIndex = form.imageAssets.findIndex((asset) => (asset.url || asset.previewUrl) === form.image);
      const primary = images[selectedIndex >= 0 ? selectedIndex : 0];
      await onSave({ ...form, images, image: primary.url, imagePublicId: primary.publicId, imageAssets: undefined }, initial ? itemId(initial) : null);
    } catch (err) {
      notify(err?.response?.data?.message || err.message || "Không thể lưu banner.", "error");
    } finally {
      setUploading(false);
    }
  };
  return (
    <AdminModal title={initial ? "Sửa banner" : "Thêm banner"} onClose={uploading ? () => {} : onClose} className="banner-form-modal">
      <form className="admin-form banner-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Tiêu đề<input required value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
          <label>Text nút<input value={form.buttonText} onChange={(e) => update("buttonText", e.target.value)} /></label>
          <label>Link nút<input value={form.buttonLink} onChange={(e) => update("buttonLink", e.target.value)} /></label>
          <ModalSelect label="Vị trí" value={form.position} onChange={(value) => update("position", value)} options={[["hero", "Hero"], ["home", "Home"], ["top", "Top"], ["collection", "Collection"]]} />
          <PlainNumberInput label="Thứ tự" value={form.sortOrder} min={0} onChange={(value) => update("sortOrder", value)} />
          <ModalSelect label="Trạng thái" value={form.status} onChange={(value) => update("status", value)} options={[["active", "Đang hiển thị"], ["inactive", "Đã ẩn"]]} />
        </div>
        <label>Mô tả<textarea value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} /></label>
        <MultiImageUploader label="Ảnh banner" value={form.imageAssets} max={6} deferred primaryUrl={form.image} notify={notify} previewClassName="banner-image-preview" onChange={(assets) => setForm((current) => { const primaryExists = assets.some((asset) => (asset.url || asset.previewUrl) === current.image); const primary = primaryExists ? current.image : assets[0]?.url || assets[0]?.previewUrl || ""; return { ...current, imageAssets: assets, image: primary }; })} onPrimaryChange={(identity) => update("image", identity)} />
        <div className="modal-actions"><AdminButton type="button" onClick={onClose} disabled={uploading}>Hủy</AdminButton><AdminButton type="submit" variant="primary" disabled={uploading}>{uploading ? "Đang lưu..." : "Lưu banner"}</AdminButton></div>
      </form>
    </AdminModal>
  );
}

const orderSteps = [
  ["pending", "\u0043\u0068\u1EDD\u0020\u0078\u00E1\u0063\u0020\u006E\u0068\u1EAD\u006E"],
  ["confirmed", "\u0110\u00E3\u0020\u0078\u00E1\u0063\u0020\u006E\u0068\u1EAD\u006E"],
  ["deposit_paid", "\u0110\u00E3\u0020\u0111\u1EB7\u0074\u0020\u0063\u1ECD\u0063"],
  ["ready_to_pickup", "\u0053\u1EB5\u006E\u0020\u0073\u00E0\u006E\u0067\u0020\u006E\u0068\u1EAD\u006E\u0020\u0111\u1ED3"],
  ["renting", "\u0110\u0061\u006E\u0067\u0020\u0074\u0068\u0075\u00EA"],
  ["returned", "\u0110\u00E3\u0020\u0074\u0072\u1EA3\u0020\u0111\u1ED3"],
  ["completed", "\u0048\u006F\u00E0\u006E\u0020\u0074\u1EA5\u0074"]
];

const orderToastMessages = {
  approve: "\u0044\u0075\u0079\u1EC7\u0074\u0020\u0111\u01A1\u006E\u0020\u0074\u0068\u0075\u00EA\u0020\u0074\u0068\u00E0\u006E\u0068\u0020\u0063\u00F4\u006E\u0067.",
  reject: "\u0054\u1EEB\u0020\u0063\u0068\u1ED1\u0069\u0020\u0111\u01A1\u006E\u0020\u0074\u0068\u0075\u00EA\u0020\u0074\u0068\u00E0\u006E\u0068\u0020\u0063\u00F4\u006E\u0067.",
  paid: "\u0058\u00E1\u0063\u0020\u006E\u0068\u1EAD\u006E\u0020\u0111\u1EB7\u0074\u0020\u0063\u1ECD\u0063\u0020\u0074\u0068\u00E0\u006E\u0068\u0020\u0063\u00F4\u006E\u0067.",
  ready: "\u0110\u01A1\u006E\u0020\u0111\u00E3\u0020\u0073\u1EB5\u006E\u0020\u0073\u00E0\u006E\u0067\u0020\u006E\u0068\u1EAD\u006E\u0020\u0111\u1ED3.",
  pickedUp: "\u0043\u1EAD\u0070\u0020\u006E\u0068\u1EAD\u0074\u0020\u006B\u0068\u00E1\u0063\u0068\u0020\u0111\u00E3\u0020\u006E\u0068\u1EAD\u006E\u0020\u0111\u1ED3\u0020\u0074\u0068\u00E0\u006E\u0068\u0020\u0063\u00F4\u006E\u0067.",
  returned: "\u0043\u1EAD\u0070\u0020\u006E\u0068\u1EAD\u0074\u0020\u006B\u0068\u00E1\u0063\u0068\u0020\u0111\u00E3\u0020\u0074\u0072\u1EA3\u0020\u0111\u1ED3\u0020\u0074\u0068\u00E0\u006E\u0068\u0020\u0063\u00F4\u006E\u0067.",
  inspection: "\u004C\u01B0\u0075\u0020\u0062\u0069\u00EA\u006E\u0020\u0062\u1EA3\u006E\u0020\u006B\u0069\u1EC3\u006D\u0020\u0074\u0072\u0061\u0020\u0074\u0072\u1EA3\u0020\u0111\u1ED3\u0020\u0074\u0068\u00E0\u006E\u0068\u0020\u0063\u00F4\u006E\u0067.",
  complete: "\u0048\u006F\u00E0\u006E\u0020\u0074\u1EA5\u0074\u0020\u0111\u01A1\u006E\u0020\u0074\u0068\u0075\u00EA\u0020\u0074\u0068\u00E0\u006E\u0068\u0020\u0063\u00F4\u006E\u0067.",
  movedOutOfFilter: "\u0110\u01A1\u006E\u0020\u0111\u00E3\u0020\u0111\u01B0\u1EE3\u0063\u0020\u0063\u1EAD\u0070\u0020\u006E\u0068\u1EAD\u0074\u0020\u0076\u00E0\u0020\u006B\u0068\u00F4\u006E\u0067\u0020\u0063\u00F2\u006E\u0020\u0074\u0068\u0075\u1ED9\u0063\u0020\u0062\u1ED9\u0020\u006C\u1ECD\u0063\u0020\u0068\u0069\u1EC7\u006E\u0020\u0074\u1EA1\u0069."
};

function OrderStepper({ status }) {
  const activeIndex = orderSteps.findIndex(([value]) => value === status);
  const canceled = status === "canceled" || status === "rejected";
  return (
    <div className="order-stepper" aria-label="Tiến trình đơn thuê">
      {orderSteps.map(([value, label], index) => (
        <div key={value} className={`order-step ${!canceled && activeIndex >= index ? "done" : ""} ${status === value ? "active" : ""}`}>
          <span>{index + 1}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

function AdminOrders({ orders, selected, selectedOrderId, setSelectedOrderId, notify, reload, inspectionOnly = false }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [inspection, setInspection] = useState({ condition: "good", lateDays: 0, damageFee: 0, note: "" });
  const firstItem = selected?.items?.[0];
  const filtered = filter === "all" ? orders : orders.filter((order) => order.status === filter);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedOrders = filtered.slice((page - 1) * pageSize, page * pageSize);
  const isOutsideCurrentFilter = (items, keepId) => {
    if (!keepId || filter === "all") return false;
    const nextOrder = findById(items, keepId);
    return Boolean(nextOrder && nextOrder.status !== filter);
  };

  const action = async (path, successMessage) => {
    const keepId = itemId(selected) || selectedOrderId;
    try {
      await runAdminOrderAction(path);
      notify(successMessage);
      const nextOrders = await reload(keepId);
      if (keepId && (!findById(nextOrders, keepId) || isOutsideCurrentFilter(nextOrders, keepId))) notify(orderToastMessages.movedOutOfFilter);
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const reject = async (order) => {
    const keepId = itemId(order);
    const reason = window.prompt("Nh\u1EADp l\u00FD do t\u1EEB ch\u1ED1i \u0111\u01A1n thu\u00EA:");
    if (!reason) return;
    try {
      await rejectRentalOrder(itemId(order), reason);
      notify("T\u1EEB ch\u1ED1i \u0111\u01A1n thu\u00EA th\u00E0nh c\u00F4ng.");
      const nextOrders = await reload(keepId);
      if (keepId && (!findById(nextOrders, keepId) || isOutsideCurrentFilter(nextOrders, keepId))) notify(orderToastMessages.movedOutOfFilter);
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const saveInspection = async () => {
    const keepId = itemId(selected) || selectedOrderId;
    try {
      await createReturnInspection(itemId(selected), { ...inspection, costumeId: itemId(firstItem?.costume) });
      notify("L\u01B0u bi\u00EAn b\u1EA3n ki\u1EC3m tra tr\u1EA3 \u0111\u1ED3 th\u00E0nh c\u00F4ng.");
      await reload(keepId);
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const orderActions = selected ? [
    selected.status === "pending" && { label: "\u0044\u0075\u0079\u1EC7\u0074\u0020\u0111\u01A1\u006E", tone: "primary", run: () => action(`/admin/rental-orders/${itemId(selected)}/approve`, orderToastMessages.approve) },
    ["pending", "confirmed"].includes(selected.status) && { label: "\u0054\u1EEB\u0020\u0063\u0068\u1ED1\u0069\u0020\u0111\u01A1\u006E", run: () => reject(selected) },
    selected.status === "deposit_paid" && { label: "\u0053\u1EB5\u006E\u0020\u0073\u00E0\u006E\u0067\u0020\u006E\u0068\u1EAD\u006E\u0020\u0111\u1ED3", tone: "primary", run: () => action(`/admin/rental-orders/${itemId(selected)}/ready-for-pickup`, orderToastMessages.ready) },
    selected.status === "ready_to_pickup" && { label: "\u004B\u0068\u00E1\u0063\u0068\u0020\u0111\u00E3\u0020\u006E\u0068\u1EAD\u006E\u0020\u0111\u1ED3", tone: "primary", run: () => action(`/admin/rental-orders/${itemId(selected)}/picked-up`, orderToastMessages.pickedUp) },
    ["renting", "overdue"].includes(selected.status) && { label: "\u004B\u0068\u00E1\u0063\u0068\u0020\u0111\u00E3\u0020\u0074\u0072\u1EA3\u0020\u0111\u1ED3", tone: "primary", run: () => action(`/admin/rental-orders/${itemId(selected)}/returned`, orderToastMessages.returned) },
    selected.status === "returned" && { label: "\u0048\u006F\u00E0\u006E\u0020\u0074\u1EA5\u0074\u0020\u0111\u01A1\u006E", tone: "primary", run: () => action(`/admin/rental-orders/${itemId(selected)}/complete`, orderToastMessages.complete) }
  ].filter(Boolean) : [];

  return (
    <section className="orders-layout admin-orders">
      <div className="admin-card">
        <PageHeader title={inspectionOnly ? "Kiểm tra trả đồ" : "Danh sách đơn thuê"} subtitle={inspectionOnly ? "Ghi nhận tình trạng trả và phí phát sinh." : "Duyệt, chuyển trạng thái và theo dõi đơn thuê."} />
        {!inspectionOnly && <AdminSelect value={filter} onChange={(value) => { setFilter(value); setPage(1); }} options={[["all", "Tất cả"], ["pending", "Chờ xác nhận"], ["confirmed", "Đã xác nhận"], ["deposit_paid", "Đã đặt cọc"], ["ready_to_pickup", "Sẵn sàng nhận đồ"], ["renting", "Đang thuê"], ["returned", "Đã trả đồ"], ["completed", "Hoàn tất"], ["canceled", "Đã hủy"]]} />}
        {filtered.length === 0 && <EmptyState text="Chưa có đơn thuê phù hợp." />}
        {pagedOrders.map((order) => (
          <button key={itemId(order)} className={`order-row ${itemId(selected) === itemId(order) ? "selected" : ""}`} onClick={() => setSelectedOrderId(itemId(order))}>
            <div className="order-row-head">
              <StatusBadge value={order.status} />
              <small>#{String(itemId(order)).slice(-6).toUpperCase()}</small>
            </div>
            <strong>{order.customer?.name || "Khách thuê"}</strong>
            <small>{order.items.map(costumeName).join(", ")}</small>
            <div className="order-row-meta">
              <span>{formatDate(order.rentalDate)} - {formatDate(order.returnDate)}</span>
              <b>{money(orderTotal(order))}</b>
            </div>
          </button>
        ))}
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
      </div>
      <div className="admin-card order-detail">
        {!selected ? <EmptyState text="Chọn đơn để xử lý." /> : (
          <>
            <div className="section-title"><h2>Chi tiết đơn thuê</h2><StatusBadge value={selected.status} /></div>
            <p><strong>Khách:</strong> {selected.customer?.name} - {selected.customer?.phone}</p>
            <OrderStepper status={selected.status} />
            <OrderDetail order={selected} readonly />
            {!inspectionOnly && (
              <div className="order-action-panel">
                <h3>Thao tác tiếp theo</h3>
                {orderActions.length === 0 ? <EmptyState text="Đơn này không còn thao tác tiếp theo." /> : orderActions.map((item) => (
                  <button key={item.label} type="button" className={`order-action-card ${item.tone === "primary" ? "primary" : ""}`} onClick={item.run}>
                    <strong>{item.label}</strong>
                    <small>Chỉ hiển thị khi trạng thái đơn cho phép thao tác này.</small>
                  </button>
                ))}
              </div>
            )}
            {false && !inspectionOnly && <div className="admin-actions">
              <AdminButton disabled={selected.status !== "pending"} onClick={() => action(`/admin/rental-orders/${itemId(selected)}/approve`)}>Duyệt đơn</AdminButton>
              <AdminButton disabled={!["pending", "confirmed"].includes(selected.status)} onClick={() => reject(selected)}>Từ chối</AdminButton>
              <AdminButton disabled={!["confirmed", "deposit_paid"].includes(selected.status)} onClick={() => action(`/admin/rental-orders/${itemId(selected)}/ready-for-pickup`)}>Sẵn sàng nhận đồ</AdminButton>
              <AdminButton disabled={selected.status !== "ready_to_pickup"} onClick={() => action(`/admin/rental-orders/${itemId(selected)}/picked-up`)}>Khách đã nhận đồ</AdminButton>
              <AdminButton disabled={!["renting", "overdue"].includes(selected.status)} onClick={() => action(`/admin/rental-orders/${itemId(selected)}/returned`)}>Khách đã trả đồ</AdminButton>
              <AdminButton variant="primary" disabled={selected.status !== "returned"} onClick={() => action(`/admin/rental-orders/${itemId(selected)}/complete`)}>Hoàn tất đơn</AdminButton>
            </div>}
            <div className="inspection">
              <h3>Biên bản kiểm tra trả đồ</h3>
              <ModalSelect label="Tình trạng" value={inspection.condition} onChange={(value) => setInspection({ ...inspection, condition: value })} options={[["good", "Tốt"], ["dirty", "Bẩn cần giặt"], ["damaged", "Hư hỏng"], ["lost_accessory", "Mất phụ kiện"], ["lost", "Mất trang phục"]]} />
              <PlainNumberInput label="Số ngày trễ" value={inspection.lateDays} min={0} onChange={(value) => setInspection({ ...inspection, lateDays: value })} />
              <MoneyThousandsInput label="Phí hư hỏng" value={inspection.damageFee} onChange={(value) => setInspection({ ...inspection, damageFee: value })} />
              <input placeholder="Ghi chú kiểm tra" value={inspection.note} onChange={(e) => setInspection({ ...inspection, note: e.target.value })} />
              <AdminButton disabled={selected.status !== "returned"} onClick={saveInspection}>Lưu kiểm tra</AdminButton>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SimpleResource({ title, rows, columns, labels, format = {} }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 600);
  const filtered = asArray(rows).filter((row) => Object.values(row || {}).join(" ").toLowerCase().includes(debouncedSearch.toLowerCase()));
  return (
    <>
      <PageHeader title={title} subtitle="Danh sách dữ liệu quản trị, có tìm kiếm và phân trang." />
      <div className="admin-card">
        <div className="admin-toolbar admin-toolbar--search-only">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm trong ${title.toLowerCase()}...`}
          />
        </div>
        <AdminTable rows={filtered} columns={columns} labels={labels} format={format} />
      </div>
    </>
  );
}

function display(value) {
  return value === undefined || value === null || value === "" ? "-" : value;
}

const paymentTypeLabels = {
  deposit: "Tiền cọc",
  full: "Thanh toán toàn bộ",
  rental_balance: "Phần còn lại",
  penalty: "Phí phát sinh",
  refund: "Hoàn cọc"
};

function PaymentManager({ rows, notify, reload, canConfirm }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderFilter = searchParams.get("orderId") || "";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search, 600);
  const legacyPaymentId = searchParams.get("paymentId") || "";
  const [liveRows, setLiveRows] = useState(asArray(rows));

  useEffect(() => setLiveRows(asArray(rows)), [rows]);

  useEffect(() => {
    if (legacyPaymentId) navigate(`/payments/${legacyPaymentId}`, { replace: true });
  }, [legacyPaymentId, navigate]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const data = await fetchAdminPayments({ page: 1, limit: 100 });
        if (active) setLiveRows(data.items);
      } catch {
        // Giữ dữ liệu hiện có; lần polling sau sẽ thử lại.
      }
    };
    const timer = window.setInterval(refresh, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const filtered = liveRows.filter((row) => {
    if (row.paymentType === "refund") return false;
    const matchesOrder = !orderFilter || itemId(row.orderId || row.order) === orderFilter;
    const matchesSearch = Object.values(row || {}).join(" ").toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesStatus = !statusFilter || row.status === statusFilter;
    const matchesType = !typeFilter || row.paymentType === typeFilter;
    const matchesMethod = !methodFilter || row.method === methodFilter;
    return matchesOrder && matchesSearch && matchesStatus && matchesType && matchesMethod;
  });

  return (
    <>
      <PageHeader title={"Qu\u1ea3n l\u00fd thanh to\u00e1n"} subtitle={"Theo d\u00f5i tr\u1ea1ng th\u00e1i thanh to\u00e1n, ph\u01b0\u01a1ng th\u1ee9c v\u00e0 chi ti\u1ebft \u0111\u01a1n thu\u00ea."} />
      <div className="admin-card">
        <div className="admin-toolbar admin-payment-filters">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={"T\u00ecm theo m\u00e3, kh\u00e1ch h\u00e0ng, tr\u1ea1ng th\u00e1i..."} />
          <AdminSelect value={statusFilter} onChange={setStatusFilter} options={[["", "Tất cả trạng thái"], ["pending", "Đang chờ thanh toán"], ["awaiting_confirmation", "Chờ cửa hàng xác nhận"], ["success", "Thành công"], ["failed", "Thất bại"], ["canceled", "Đã hủy"], ["expired", "Hết hạn"], ["refunded", "Đã hoàn tiền"]]} />
          <AdminSelect value={typeFilter} onChange={setTypeFilter} options={[["", "Tất cả loại thanh toán"], ["deposit", "Tiền cọc"], ["full", "Thanh toán toàn bộ"], ["rental_balance", "Thanh toán phần còn lại"], ["penalty", "Phí phát sinh"]]} />
          <AdminSelect value={methodFilter} onChange={setMethodFilter} options={[["", "Tất cả phương thức"], ["cash", "Tiền mặt khi nhận đồ"], ["bank_transfer", "Chuyển khoản cửa hàng xác nhận"], ["payos", "QR ngân hàng (payOS)"]]} />
        </div>
        <AdminTable
          rows={filtered}
          columns={["paymentReference", "orderId", "amount", "method", "provider", "paymentType", "status", "createdAt"]}
          labels={["Mã giao dịch", "Đơn thuê", "Số tiền", "Phương thức", "Provider", "Loại", "Trạng thái", "Ngày tạo"]}
          format={{
            amount: money,
            createdAt: formatDateTime,
            customerId: (value) => value?.name || value?.email || "-",
            orderId: (value) => value?._id ? `#${String(value._id).slice(-6).toUpperCase()}` : "-",
            paymentType: (value) => paymentTypeLabels[value] || value,
            method: (value) => value === "payos" ? "QR ngân hàng" : value === "cash" ? "Tiền mặt" : value === "bank_transfer" ? "Chuyển khoản ngân hàng" : value,
            provider: (value) => value === "payos" ? "payOS" : value,
            status: (value) => <span className={"badge " + value}>{getStatusLabel(value)}</span>
          }}
          actions={(row) => <AdminButton onClick={() => navigate(`/payments/${itemId(row)}`)}><Eye size={14} /> Xem</AdminButton>}
          tableClassName="payment-table"
          colWidths={["175px", "100px", "110px", "160px", "90px", "180px", "170px", "150px", "110px"]}
        />
      </div>
    </>
  );
}

function PaymentDetailModal({ id, fallback, notify, onChanged, onClose, canConfirm = true }) {
  const [payment, setPayment] = useState(fallback || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getAdminPaymentDetail(id)
      .then((response) => { if (alive) setPayment(response || fallback || null); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const order = payment?.orderId || payment?.order || {};
  const customer = payment?.customerId || payment?.customer || order.customerId || {};
  const items = asArray(order.items);
  const penaltyFee = (order.lateFee || 0) + (order.damageFee || 0);
  const totalAmount = orderTotal(order);
  const isRefund = payment?.paymentType === "refund";
  const refundDestination = payment?.refundDestination;

  return (
    <AdminModal title={"Chi ti\u1ebft thanh to\u00e1n"} onClose={onClose} className="payment-detail-modal">
      {loading && <LoadingState />}
      {error && <div className="admin-state error">{error}</div>}
      {payment && (
        <div className="payment-detail">
          <section className="payment-review-summary">
            <div><small>GIAO DỊCH KHÁCH HÀNG</small><h2>{money(payment.amount)}</h2><p>{paymentTypeLabels[payment.paymentType] || payment.paymentType} · {order.orderCode || `ARA-${String(itemId(order)).slice(-6).toUpperCase()}`}</p></div>
            <span className={`badge ${payment.status}`}>{getStatusLabel(payment.status)}</span>
          </section>
          <div className="detail-list payment-transaction-details">
            <DetailRow label={isRefund ? "Mã hoàn cọc" : "Mã thanh toán"} value={isRefund ? (payment.refundCode || payment.paymentReference) : (payment.paymentReference || itemId(payment))} />
            <DetailRow label={"M\u00e3 \u0111\u01a1n thu\u00ea"} value={order.orderCode || `ARA-${String(itemId(order)).slice(-6).toUpperCase()}`} />
            <DetailRow label={"Kh\u00e1ch h\u00e0ng"} value={customer.name || customer.email || customer.phone} />
            <DetailRow label={"S\u1ed1 ti\u1ec1n"} value={money(payment.amount)} />
            <DetailRow label={"Ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n"} value={({ cash: "Tiền mặt", bank_transfer: "Chuyển khoản ngân hàng", momo: "MoMo", vnpay: "VNPay", payos: "PayOS", bank_gateway: "Cổng ngân hàng" })[payment.method] || payment.method} />
            <DetailRow label="Minh chứng chuyển khoản" value={payment.proofAccessUrl ? <a className="payment-proof-link" href={payment.proofAccessUrl} target="_blank" rel="noreferrer">Mở ảnh minh chứng</a> : payment.method === "bank_transfer" ? "Khách chưa gửi minh chứng" : "Không áp dụng"} />
            {!isRefund && <DetailRow label="Nhà cung cấp" value={payment.provider === "payos" ? "payOS" : payment.provider} />}
            {!isRefund && <DetailRow label="Mã đơn provider" value={payment.providerOrderCode || payment.providerOrderId} />}
            {!isRefund && <DetailRow label="Mã giao dịch provider" value={payment.providerTransactionId} />}
            <DetailRow label={"Lo\u1ea1i thanh to\u00e1n"} value={paymentTypeLabels[payment.paymentType] || payment.paymentType} />
            <DetailRow label={"M\u00e3 tham chi\u1ebfu"} value={payment.paymentReference} />
            <DetailRow label={"Tr\u1ea1ng th\u00e1i"} value={payment.status} status />
            <DetailRow label={"Ng\u00e0y thanh to\u00e1n"} value={formatDateTime(payment.paidAt)} />
            <DetailRow label={"Ng\u00e0y t\u1ea1o"} value={formatDateTime(payment.createdAt)} />
          </div>
          {isRefund && (
            <section className="admin-refund-destination-card">
              <header><span>THÔNG TIN NHẬN HOÀN CỌC</span><h2>{refundDestination?.label || "Khách chưa cung cấp điểm nhận hoàn cọc"}</h2></header>
              {refundDestination?.type === "bank_account" && <dl><div><dt>Ngân hàng</dt><dd>{refundDestination.bankName || "Chưa cập nhật"}</dd></div><div><dt>Chủ tài khoản</dt><dd>{refundDestination.accountHolderName || "Chưa cập nhật"}</dd></div><div><dt>Số tài khoản</dt><dd>{refundDestination.accountNumber || "Chưa cập nhật"}</dd></div></dl>}
              {refundDestination?.type === "vietqr_image" && refundDestination.qrAsset?.secureUrl && <div className="admin-refund-qr"><img src={refundDestination.qrAsset.secureUrl} alt="Mã VietQR nhận hoàn cọc của khách"/><a href={refundDestination.qrAsset.secureUrl} target="_blank" rel="noreferrer">Mở ảnh QR kích thước đầy đủ</a></div>}
              {!refundDestination && <p className="admin-refund-missing">Chưa thể hoàn tiền. Khách cần thêm tài khoản ngân hàng hoặc ảnh VietQR nhận hoàn cọc.</p>}
            </section>
          )}
          <div className="detail-list payment-order-totals">
            <DetailRow label={"Ng\u00e0y thu\u00ea"} value={formatDate(order.rentalDate)} />
            <DetailRow label={"Ng\u00e0y tr\u1ea3"} value={formatDate(order.returnDate)} />
            <DetailRow label={"Tr\u1ea1ng th\u00e1i \u0111\u01a1n"} value={order.status} status />
            <DetailRow label={"Ti\u1ec1n thu\u00ea"} value={money(order.totalRentalPrice)} />
            <DetailRow label={"Ti\u1ec1n c\u1ecdc"} value={money(order.totalDepositAmount)} />
            <DetailRow label={"Ph\u00ed ph\u1ea1t"} value={money(penaltyFee)} />
            <DetailRow label={"T\u1ed5ng ti\u1ec1n"} value={money(totalAmount)} />
          </div>
          <div className="admin-table-wrap">
            <h2>{"Trang ph\u1ee5c trong \u0111\u01a1n"}</h2>
            {items.length === 0 ? <EmptyState text={"Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u trang ph\u1ee5c trong \u0111\u01a1n."} /> : (
              <table>
                <thead><tr><th>{"\u1ea2nh"}</th><th>{"T\u00ean trang ph\u1ee5c"}</th><th>{"S\u1ed1 l\u01b0\u1ee3ng"}</th><th>{"Gi\u00e1 thu\u00ea"}</th></tr></thead>
                <tbody>{items.map((item, index) => {
                  const costume = item.costume || item.costumeId || {};
                  return (
                    <tr key={itemId(item) || index}>
                      <td><img className="admin-thumb" src={resolveImageUrl(costume.image || costume.images?.[0])} alt={costume.name || "Trang phục"} onError={(event) => { event.currentTarget.src = "/placeholder.png"; }} /></td>
                      <td>{display(costume.name)}</td>
                      <td>{display(item.quantity)}</td>
                      <td>{money(item.rentalPricePerDay)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </div>
          <div className="modal-actions">
            {canConfirm && payment.status === "awaiting_confirmation" && (
              <>
                <AdminButton
                  variant="primary"
                  disabled={actionLoading || (isRefund && !refundDestination)}
                  onClick={async () => {
                    try {
                      setActionLoading(true);
                      const updated = await confirmPayment(id);
                      setPayment(updated);
                      notify?.("Đã xác nhận đúng giao dịch khách hàng tạo.", "success");
                      await onChanged?.();
                    } catch (err) {
                      notify?.(err.message, "error");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  {payment.paymentType === "refund" ? "Xác nhận đã hoàn tiền" : "Xác nhận đã nhận tiền"}
                </AdminButton>
                <AdminButton
                  disabled={actionLoading}
                  onClick={() => { setRejectReason(""); setRejectError(""); setRejectOpen(true); }}
                >Từ chối</AdminButton>
              </>
            )}
            <AdminButton onClick={onClose}>{"\u0110\u00f3ng"}</AdminButton>
          </div>
          {rejectOpen && (
            <AdminModal title="Từ chối giao dịch" onClose={() => !actionLoading && setRejectOpen(false)} className="payment-reject-modal">
              <div className="payment-reject-copy">
                <span className="payment-reject-kicker">PAYMENT REVIEW</span>
                <h3>Xác nhận từ chối khoản thanh toán</h3>
                <p>Lý do sẽ được lưu trong lịch sử giao dịch và hiển thị cho khách hàng.</p>
              </div>
              <label className="admin-reject-field">
                <span>Lý do từ chối <b>*</b></span>
                <textarea
                  autoFocus
                  maxLength={500}
                  value={rejectReason}
                  placeholder="Ví dụ: Chưa nhận được tiền, sai số tiền hoặc sai nội dung chuyển khoản..."
                  onChange={(event) => { setRejectReason(event.target.value); setRejectError(""); }}
                />
                <small>{rejectReason.trim().length}/500 ký tự</small>
              </label>
              {rejectError && <p className="admin-modal-error">{rejectError}</p>}
              <div className="modal-actions">
                <AdminButton type="button" disabled={actionLoading} onClick={() => setRejectOpen(false)}>Quay lại</AdminButton>
                <AdminButton
                  type="button"
                  variant="danger"
                  disabled={actionLoading}
                  onClick={async () => {
                    const reason = rejectReason.trim();
                    if (reason.length < 5) return setRejectError("Vui lòng nhập lý do cụ thể, tối thiểu 5 ký tự.");
                    try {
                      setActionLoading(true);
                      const updated = await rejectPayment(id, reason);
                      setPayment(updated);
                      setRejectOpen(false);
                      notify?.("Đã từ chối giao dịch.", "success");
                      await onChanged?.();
                    } catch (err) {
                      setRejectError(err.message || "Không thể từ chối giao dịch.");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >{actionLoading ? "Đang xử lý..." : "Xác nhận từ chối"}</AdminButton>
              </div>
            </AdminModal>
          )}
        </div>
      )}
    </AdminModal>
  );
}

function DetailRow({ label, value, status = false }) {
  return <div className="detail-row"><span>{label}</span><strong>{status ? getStatusLabel(value) : display(value)}</strong></div>;
}

function Reports({ stats, orders, costumes, summary }) {
  return (
    <>
      <PageHeader title="Báo cáo" subtitle="Tổng hợp nhanh doanh thu, đơn thuê và tình trạng kho." />
      <div className="metric-grid">
        <Metric icon={<CreditCard />} label="Doanh thu" value={money(summary?.revenue || 0)} />
        <Metric icon={<ClipboardCheck />} label="Số đơn thuê" value={orders.length} />
        <Metric icon={<Shirt />} label="Đơn đang thuê" value={stats.renting} />
        <Metric icon={<CheckCircle2 />} label="Đơn hoàn tất" value={stats.completed} />
        <Metric icon={<Shirt />} label="Sản phẩm có sẵn" value={stats.available} />
        <Metric icon={<PackageCheck />} label="Sản phẩm đang giặt" value={stats.laundry} />
      </div>
      <div className="admin-two-columns">
        <AdminTable title="Đơn thuê gần đây" rows={orders.slice(0, 8)} columns={["status", "totalRentalPrice", "totalDepositAmount"]} labels={["Trạng thái", "Tiền thuê", "Tiền cọc"]} format={{ totalRentalPrice: money, totalDepositAmount: money }} />
        <AdminTable title="Kho trang phục" rows={costumes.slice(0, 8)} columns={["name", "status", "rentalPricePerDay"]} labels={["Tên", "Trạng thái", "Giá thuê"]} format={{ status: (v) => <StatusBadge type="costume" value={v} />, rentalPricePerDay: money }} />
      </div>
    </>
  );
}

function Metric({ icon, label, value }) {
  return <div className="metric admin-card">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function isMoneyColumn(column) {
  return /price|amount|fee|deposit|revenue|total|value/i.test(column);
}

function AdminTable({ title, rows = [], columns, labels, format = {}, actions, colWidths = [], columnClasses = {}, tableClassName = "", mobileCards = false }) {
  const safeRows = asArray(rows);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(safeRows.length / pageSize));
  const pagedRows = safeRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className={`admin-table-wrap ${mobileCards ? "admin-table-mobile-cards" : ""}`.trim()}>
      {title && <h2>{title}</h2>}
      {safeRows.length === 0 ? <EmptyState /> : (
        <>
          <table className={tableClassName}>
            {(colWidths.length > 0 || actions) && (
              <colgroup>
                {columns.map((col, index) => {
                  const width = colWidths[index] || (isMoneyColumn(col) ? "110px" : "");
                  return <col key={col} style={width ? { width } : undefined} />;
                })}
                {actions && <col style={{ width: colWidths[columns.length] || "180px" }} />}
              </colgroup>
            )}
            <thead><tr>{labels.map((label) => <th key={label}>{label}</th>)}{actions && <th className="action-cell">Thao tác</th>}</tr></thead>
            <tbody>{pagedRows.map((row, index) => (
              <tr key={itemId(row) || index}>
                {columns.map((col, columnIndex) => {
                  const value = format[col] ? format[col](row[col], row) : col === "status" ? <StatusBadge value={row[col]} /> : row[col];
                  const className = ["admin-cell", isMoneyColumn(col) ? "money-cell" : "", columnClasses[col] || ""].filter(Boolean).join(" ");
                  return <td key={col} className={className} data-label={mobileCards ? labels[columnIndex] : undefined}><span className="cell-content">{value}</span></td>;
                })}
                {actions && <td className="action-cell" data-label={mobileCards ? "Thao tác" : undefined}><div className="action-group row-actions">{actions(row)}</div></td>}
              </tr>
            ))}</tbody>
          </table>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
        </>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, setPage }) {
  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</button>
      <span>{page}/{totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Sau</button>
    </div>
  );
}
