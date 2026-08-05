import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Eye,
  History,
  Landmark,
  Mail,
  MapPin,
  Phone,
  KeyRound,
  ShieldCheck,
  Truck,
  UserRound,
  WalletCards
} from "lucide-react";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  useNavigate,
  useParams
} from "react-router-dom";

import {
  AdminDetailSection,
  AdminButton,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge
} from "../components/common/AdminUI.jsx";

import { StateMessage } from "../components/common/StateMessage.jsx";
import {
  getAdminCustomer,
  getCustomerPasswordResetGrant,
  grantCustomerPasswordReset,
  revokeCustomerPasswordReset
} from "../services/customerService.js";
import { AdminModal } from "../components/common/AdminControls.jsx";

import {
  costumeName,
  formatVietnamPhone,
  money
} from "../utils/format.js";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";

const EMPTY_TEXT = "Chưa cập nhật";

const orderIdOf = (order) =>
  order?.id || order?._id || "";

const shortOrderId = (order) =>
  String(orderIdOf(order))
    .slice(-6)
    .toUpperCase();

function dateText(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function customerInitials(name) {
  const words = String(name || "Khách hàng")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "KH";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`
    .toUpperCase();
}

function productNames(order) {
  const names = (order?.items || [])
    .map(costumeName)
    .filter(Boolean);

  return names.length
    ? names.join(", ")
    : "Chưa có thông tin trang phục";
}

function formatAddress(address) {
  if (!address) {
    return EMPTY_TEXT;
  }

  if (typeof address === "string") {
    return address;
  }

  if (typeof address !== "object") {
    return String(address);
  }

  const parts = [
    address.addressLine,
    address.street,
    address.ward,
    address.wardName,
    address.district,
    address.districtName,
    address.city,
    address.province,
    address.provinceName
  ].filter(Boolean);

  return parts.length
    ? parts.join(", ")
    : EMPTY_TEXT;
}

const resetGrantLabels = {
  none: "Chưa mở quyền",
  active: "Đang có hiệu lực",
  used: "Đã sử dụng",
  revoked: "Đã hủy",
  expired: "Đã hết hạn"
};

function maskPhone(value) {
  const phone = formatVietnamPhone(value).replace(/\s/g, "");
  if (phone.length < 7) return phone || "Chưa cập nhật";
  return `${phone.slice(0, 4)} *** ${phone.slice(-3)}`;
}

function dateTimeText(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function AdminCustomerDetailPage({ notify }) {
  const { can } = useAdminAuth();
  const canViewSensitive = can(P.CUSTOMERS_MANAGE_SENSITIVE);
  const canResetPassword = can(P.CUSTOMERS_RESET_PASSWORD);
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [resetGrant, setResetGrant] = useState(null);
  const [resetGrantLoading, setResetGrantLoading] = useState(false);
  const [resetGrantError, setResetGrantError] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const securityBusyRef = useRef(false);
  const grantRequestRef = useRef(0);

  const loadResetGrant = useCallback(async () => {
    if (!canResetPassword) return;
    const requestId = ++grantRequestRef.current;
    setResetGrantLoading(true);
    setResetGrantError("");
    try {
      const grant = await getCustomerPasswordResetGrant(id);
      if (requestId !== grantRequestRef.current) return;
      setResetGrant(grant);
    } catch (grantError) {
      if (requestId !== grantRequestRef.current) return;
      setResetGrantError(grantError.message || "Không thể tải trạng thái quyền đặt lại mật khẩu.");
    } finally {
      if (requestId === grantRequestRef.current) setResetGrantLoading(false);
    }
  }, [canResetPassword, id]);

  useEffect(() => {
    loadResetGrant();
    return () => { grantRequestRef.current += 1; };
  }, [loadResetGrant]);

  const remainingSeconds = resetGrant?.status === "active"
    ? Math.max(0, Math.ceil((new Date(resetGrant.expiresAt).getTime() - clock) / 1000))
    : 0;
  const visibleResetStatus = resetGrant?.status === "active" && remainingSeconds === 0 ? "expired" : (resetGrant?.status || "none");

  useEffect(() => {
    if (visibleResetStatus !== "active") return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [visibleResetStatus]);

  const confirmSecurityAction = async () => {
    if (!confirmAction || securityBusyRef.current) return;
    securityBusyRef.current = true;
    setSecurityBusy(true);
    setResetGrantError("");
    try {
      const data = confirmAction === "grant"
        ? await grantCustomerPasswordReset(id)
        : await revokeCustomerPasswordReset(id);
      setResetGrant(data);
      setClock(Date.now());
      setConfirmAction("");
      notify?.(confirmAction === "grant"
        ? "Khách có thể tự đặt lại mật khẩu trong 15 phút."
        : "Đã hủy quyền đặt lại mật khẩu.");
    } catch (actionError) {
      setResetGrantError(actionError.message || "Không thể cập nhật quyền đặt lại mật khẩu.");
      setConfirmAction("");
    } finally {
      securityBusyRef.current = false;
      setSecurityBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data =
          await getAdminCustomer(id);

        if (alive) {
          setCustomer(data);
        }
      } catch (err) {
        if (alive) {
          setError(
            err?.response?.data?.message ||
              err?.response?.data?.error ||
              err?.message ||
              "Không thể tải thông tin khách hàng."
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

  const orders = useMemo(
    () =>
      Array.isArray(customer?.orders)
        ? customer.orders
        : [],
    [customer]
  );

  const totalSpent = Number(
    customer?.totalSpent || 0
  );

  const orderCount =
    customer?.orderCount ?? orders.length;

  const averageSpent =
    orderCount > 0
      ? totalSpent / orderCount
      : 0;

  const latestOrder = useMemo(() => {
    if (!orders.length) {
      return null;
    }

    return orders.reduce(
      (latest, order) => {
        const currentDate = new Date(
          order.createdAt ||
            order.rentalDate ||
            0
        ).getTime();

        const latestDate = new Date(
          latest?.createdAt ||
            latest?.rentalDate ||
            0
        ).getTime();

        return currentDate > latestDate
          ? order
          : latest;
      },
      orders[0]
    );
  }, [orders]);

  return (
    <section className="admin-customer-detail-page">
      <div className="admin-customer-detail-toolbar">
        <button
          type="button"
          className="admin-customer-back-button"
          onClick={() =>
            navigate("/customers")
          }
        >
          <ArrowLeft size={17} />
          Quay lại danh sách
        </button>

        <span>
          HỒ SƠ KHÁCH HÀNG
        </span>
      </div>

      {loading && (
        <StateMessage text="Đang tải khách hàng..." />
      )}

      {error && (
        <StateMessage
          text={error}
          tone="error"
        />
      )}

      {!loading &&
        !error &&
        !customer && (
          <StateMessage text="Không tìm thấy khách hàng." />
        )}

      {!loading &&
        !error &&
        customer && (
          <>
            <div className="admin-customer-profile-hero">
              <div className="admin-customer-avatar">
                {customerInitials(
                  customer.name
                )}
              </div>

              <div className="admin-customer-profile-content">
                <AdminPageHeader
                  title={
                    customer.name ||
                    "Khách hàng chưa đặt tên"
                  }
                  description="Thông tin hồ sơ và lịch sử giao dịch của khách hàng."
                  action={
                    <AdminStatusBadge
                      value={
                        customer.status ||
                        "active"
                      }
                    />
                  }
                />

                <div className="admin-customer-contact-list">
                  <ContactItem
                    icon={<Mail size={15} />}
                    value={customer.email}
                  />

                  <ContactItem
                    icon={<Phone size={15} />}
                    value={customer.phone}
                  />

                  <ContactItem
                    icon={<MapPin size={15} />}
                    value={formatAddress(
                      customer.address
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="admin-stat-grid admin-customer-stat-grid">
              <AdminStatCard
                icon={<History />}
                label="Tổng đơn thuê"
                value={orderCount}
              />

              {canViewSensitive && <AdminStatCard
                icon={<CreditCard />}
                label="Tổng chi tiêu"
                value={money(totalSpent)}
              />}

              <AdminStatCard
                icon={<CalendarDays />}
                label="Ngày đăng ký"
                value={dateText(
                  customer.createdAt
                )}
              />
            </div>

            <div className="admin-customer-content-grid">
              <div className="admin-customer-main-column">
                <AdminDetailSection
                  icon={<UserRound />}
                  title="Thông tin cá nhân"
                >
                  <div className="admin-customer-info-grid">
                    <Info
                      label="Họ và tên"
                      value={customer.name}
                    />

                    <Info
                      label="Email"
                      value={customer.email}
                    />

                    <Info
                      label="Số điện thoại"
                      value={customer.phone}
                    />

                    <Info
                      label="Trạng thái tài khoản"
                      value={
                        <AdminStatusBadge
                          value={
                            customer.status ||
                            "active"
                          }
                        />
                      }
                    />

                    <Info
                      label="Ngày đăng ký"
                      value={dateText(
                        customer.createdAt
                      )}
                    />

                    <Info
                      label="Cập nhật gần nhất"
                      value={dateText(
                        customer.updatedAt
                      )}
                    />

                    <Info
                      label="Địa chỉ"
                      value={formatAddress(
                        customer.address
                      )}
                      wide
                    />
                  </div>
                </AdminDetailSection>

                {canResetPassword && <AdminDetailSection icon={<ShieldCheck />} title="Bảo mật tài khoản">
                  <div className="admin-customer-security-panel">
                    <p>Nhân viên chỉ mở quyền khôi phục. Khách tự nhập mật khẩu mới và mật khẩu không hiển thị trong hệ thống quản trị.</p>
                    {resetGrantLoading && <span className="admin-customer-security-message">Đang tải trạng thái...</span>}
                    {resetGrantError && <span className="admin-customer-security-message is-error" role="alert">{resetGrantError}</span>}
                    {!resetGrantLoading && <div className={`admin-customer-reset-status is-${visibleResetStatus}`}>
                      <div>
                        <span>Trạng thái</span>
                        <strong>{resetGrantLabels[visibleResetStatus]}</strong>
                      </div>
                      {visibleResetStatus === "active" && <>
                        <div><span>Thời gian còn lại</span><strong>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}</strong></div>
                        <div><span>Người mở quyền</span><strong>{resetGrant?.createdBy?.name || "Tài khoản quản trị"}</strong></div>
                        <div><span>Thời gian mở</span><strong>{dateTimeText(resetGrant?.createdAt)}</strong></div>
                      </>}
                    </div>}
                    {!resetGrantLoading && customer.status === "active" && (
                      visibleResetStatus === "active"
                        ? <AdminButton type="button" disabled={securityBusy} onClick={() => setConfirmAction("revoke")}>Hủy quyền đặt lại mật khẩu</AdminButton>
                        : <AdminButton type="button" variant="primary" disabled={securityBusy} onClick={() => setConfirmAction("grant")}><KeyRound size={16}/> Cho phép đặt lại mật khẩu</AdminButton>
                    )}
                    {customer.status !== "active" && <span className="admin-customer-security-message">Tài khoản đang bị khóa nên không thể mở quyền đặt lại mật khẩu.</span>}
                  </div>
                </AdminDetailSection>}

                <AdminDetailSection icon={<MapPin />} title="Địa chỉ giao nhận đã lưu">
                  <div className="admin-customer-info-grid">
                    {(customer.addresses || []).length ? customer.addresses.map(address => <Info key={address._id} label={`${address.label}${address.isDefault ? " · Mặc định" : ""}`} value={`${address.receiverName} · ${address.receiverPhone} · ${formatAddress(address)}`} wide/>) : <Info label="Địa chỉ" value="Khách chưa lưu địa chỉ giao nhận" wide/>}
                  </div>
                </AdminDetailSection>

                {canViewSensitive && <AdminDetailSection icon={<Landmark />} title="Điểm nhận hoàn cọc">
                  <div className="admin-customer-info-grid">
                    {(customer.refundDestinations || []).length ? customer.refundDestinations.map(destination => <Info key={destination._id} label={`${destination.label}${destination.isDefault ? " · Mặc định" : ""}`} value={destination.type === "bank_account" ? `${destination.bankName} · ${destination.accountHolderName} · ${destination.maskedAccountNumber}` : "Ảnh VietQR đã được khách cung cấp"} wide/>) : <Info label="Hoàn cọc" value="Khách chưa thêm điểm nhận hoàn cọc" wide/>}
                  </div>
                </AdminDetailSection>}

                <AdminDetailSection
                  icon={<History />}
                  title="Lịch sử đơn thuê"
                >
                  <div className="admin-customer-history-summary">
                    <div>
                      <strong>
                        {orders.length} đơn thuê
                      </strong>

                      <span>
                        Toàn bộ lịch sử thuê trang
                        phục của khách hàng.
                      </span>
                    </div>

                    {latestOrder && (
                      <span>
                        Gần nhất:{" "}
                        {dateText(
                          latestOrder.createdAt ||
                            latestOrder.rentalDate
                        )}
                      </span>
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="admin-customer-empty-history">
                      <History size={28} />

                      <strong>
                        Chưa có đơn thuê
                      </strong>

                      <span>
                        Khách hàng chưa phát sinh
                        giao dịch thuê trang phục.
                      </span>
                    </div>
                  ) : (
                    <div className="admin-customer-order-list">
                      {orders.map((order) => {
                        const orderId =
                          orderIdOf(order);

                        return (
                          <article
                            key={orderId}
                            className="admin-customer-order-card"
                          >
                            <div className="admin-customer-order-code">
                              <span>Mã đơn</span>

                              <strong>
                                #
                                {shortOrderId(
                                  order
                                )}
                              </strong>
                            </div>

                            <div className="admin-customer-order-product">
                              <span>
                                Trang phục
                              </span>

                              <strong
                                title={productNames(
                                  order
                                )}
                              >
                                {productNames(
                                  order
                                )}
                              </strong>
                              <small><Truck size={13}/> {({store_pickup:"Nhận/trả tại cửa hàng",delivery_store_return:"ARA giao tận nơi · khách trả tại cửa hàng",two_way_delivery:"ARA giao và nhận lại"})[order.fulfillment?.method] || "Nhận/trả tại cửa hàng"}</small>
                            </div>

                            <div className="admin-customer-order-date">
                              <span>
                                Thời gian thuê
                              </span>

                              <strong>
                                {dateText(
                                  order.rentalDate
                                )}
                                <i>→</i>
                                {dateText(
                                  order.returnDate
                                )}
                              </strong>
                            </div>

                            <div className="admin-customer-order-status">
                              <AdminStatusBadge
                                value={
                                  order.status
                                }
                              />
                            </div>

                            <button
                              type="button"
                              className="admin-customer-order-button"
                              onClick={() =>
                                navigate(
                                  `/orders/${orderId}`
                                )
                              }
                            >
                              <Eye size={15} />
                              Chi tiết
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </AdminDetailSection>
              </div>

              {canViewSensitive && <aside className="admin-customer-side-column">
                <AdminDetailSection
                  icon={<WalletCards />}
                  title="Tổng quan thanh toán"
                >
                  <div className="admin-customer-payment-highlight">
                    <span>
                      Tổng chi tiêu
                    </span>

                    <strong>
                      {money(totalSpent)}
                    </strong>

                    <small>
                      Tổng giá trị các đơn thuê đã
                      ghi nhận.
                    </small>
                  </div>

                  <dl className="admin-customer-money-list">
                    <div>
                      <dt>Tổng số đơn</dt>
                      <dd>{orderCount}</dd>
                    </div>

                    <div>
                      <dt>Chi tiêu trung bình</dt>
                      <dd>
                        {money(averageSpent)}
                      </dd>
                    </div>

                    <div>
                      <dt>Đơn gần nhất</dt>
                      <dd>
                        {latestOrder
                          ? `#${shortOrderId(
                              latestOrder
                            )}`
                          : "-"}
                      </dd>
                    </div>
                  </dl>
                </AdminDetailSection>

                <AdminDetailSection
                  icon={<UserRound />}
                  title="Thông tin tài khoản"
                >
                  <div className="admin-customer-account-list">
                    <AccountRow
                      label="Mã khách hàng"
                      value={
                        customer.id ||
                        customer._id
                      }
                    />

                    <AccountRow
                      label="Ngày tham gia"
                      value={dateText(
                        customer.createdAt
                      )}
                    />

                    <AccountRow
                      label="Hoạt động gần nhất"
                      value={
                        latestOrder
                          ? dateText(
                              latestOrder.createdAt ||
                                latestOrder.rentalDate
                            )
                          : "-"
                      }
                    />

                    <AccountRow
                      label="Trạng thái"
                      value={
                        <AdminStatusBadge
                          value={
                            customer.status ||
                            "active"
                          }
                        />
                      }
                    />
                  </div>
                </AdminDetailSection>
              </aside>}
            </div>
            {confirmAction && <AdminModal
              title={confirmAction === "grant" ? "Cho phép đặt lại mật khẩu" : "Hủy quyền đặt lại mật khẩu"}
              onClose={() => !securityBusy && setConfirmAction("")}
              footer={<>
                <AdminButton type="button" disabled={securityBusy} onClick={() => setConfirmAction("")}>Quay lại</AdminButton>
                <AdminButton type="button" variant="primary" disabled={securityBusy} onClick={confirmSecurityAction}>{securityBusy ? "Đang xử lý..." : "Xác nhận"}</AdminButton>
              </>}
            >
              <div className="admin-customer-reset-confirm">
                <strong>{customer.name || "Khách hàng"}</strong>
                <span>{maskPhone(customer.phoneNormalized || customer.phone)}</span>
                <p>{confirmAction === "grant" ? "Khách có thể tự đặt lại mật khẩu trong 15 phút." : "Quyền hiện tại sẽ mất hiệu lực ngay và không thể dùng để đặt lại mật khẩu."}</p>
              </div>
            </AdminModal>}
          </>
        )}
    </section>
  );
}

function ContactItem({
  icon,
  value
}) {
  return (
    <div className="admin-customer-contact-item">
      {icon}
      <span>{value || EMPTY_TEXT}</span>
    </div>
  );
}

function Info({
  label,
  value,
  wide = false
}) {
  return (
    <div
      className={[
        "admin-customer-info-item",
        wide ? "is-wide" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>

      <strong>
        {value === undefined ||
        value === null ||
        value === ""
          ? EMPTY_TEXT
          : value}
      </strong>
    </div>
  );
}

function AccountRow({
  label,
  value
}) {
  return (
    <div className="admin-customer-account-row">
      <span>{label}</span>

      <strong>
        {value === undefined ||
        value === null ||
        value === ""
          ? "-"
          : value}
      </strong>
    </div>
  );
}

export default AdminCustomerDetailPage;
