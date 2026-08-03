import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Edit3, Landmark, MapPin, Plus, Power, ShieldCheck, Star, Trash2, UserRound, WalletCards } from "lucide-react";
import {
  createAddress,
  deleteAddress,
  deleteRefundDestination,
  listAddresses,
  listRefundDestinations,
  setDefaultAddress,
  setDefaultRefundDestination,
  toggleAddress,
  toggleRefundDestination,
  updateProfile
} from "../../services/accountService.js";
import { getRentalCredits } from "../../services/rentalOrderService.js";
import { money } from "../../utils/format.js";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { RefundDestinationForm } from "../../components/customer/RefundDestinationForm.jsx";
import { AddressFormDialog } from "../../components/customer/AddressFormDialog.jsx";
import { useModalFocus } from "../../hooks/useModalFocus.js";

const tabs = [
  ["profile", "Thông tin cá nhân", UserRound],
  ["addresses", "Địa chỉ giao nhận", MapPin],
  ["refund", "Nhận hoàn cọc", Landmark],
  ["credits", "Cọc bảo lưu", WalletCards]
];

export function AccountPage({ user, notify, onUserUpdated }) {
  const [tab, setTab] = useState("profile");
  const [addresses, setAddresses] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [credits, setCredits] = useState([]);
  const [addressForm, setAddressForm] = useState(null);
  const [bankForm, setBankForm] = useState(null);
  const [profileForm, setProfileForm] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const busyActionRef = useRef("");
  const loadRequestRef = useRef(0);
  const profileTitleId = useId();
  const confirmTitleId = useId();
  const confirmDialogRef = useModalFocus(Boolean(confirmDialog), () => {
    if (!busyActionRef.current) setConfirmDialog(null);
  });
  const profileDialogRef = useModalFocus(Boolean(profileForm), () => {
    if (!busyActionRef.current) setProfileForm(null);
  });

  const load = useCallback(async ({ silent = false, signal } = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      const [addressItems, destinationItems, creditItems] = await Promise.all([
        listAddresses({ signal }),
        listRefundDestinations({ signal }),
        getRentalCredits({ signal })
      ]);
      if (requestId !== loadRequestRef.current) return false;
      setAddresses(addressItems || []);
      setDestinations(destinationItems || []);
      setCredits(creditItems || []);
      return true;
    } catch (loadError) {
      if (signal?.aborted || requestId !== loadRequestRef.current) return false;
      setError(loadError.message || "Không thể tải thông tin tài khoản. Vui lòng thử lại.");
      return false;
    } finally {
      if (!silent && requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);

  const run = async (key, task, message) => {
    if (busyActionRef.current) return false;
    busyActionRef.current = key;
    setBusyAction(key);
    try {
      await task();
      notify?.(message, "success");
      await load({ silent: true });
      return true;
    } catch (actionError) {
      notify?.(actionError.message || "Không thể hoàn thành thao tác.", "error");
      return false;
    } finally {
      busyActionRef.current = "";
      setBusyAction("");
    }
  };

  const removeAddress = (address) => {
    const detail = [address.addressLine, address.wardName, address.districtName].filter(Boolean).join(", ");
    setConfirmDialog({
      title: "Xóa địa chỉ giao nhận?",
      message: `Xóa “${address.label || detail || "Địa chỉ giao nhận"}”? Thao tác này không ảnh hưởng địa chỉ đã lưu trong các đơn cũ.`,
      action: () => run(`address-delete-${address._id}`, () => deleteAddress(address._id), "Đã xóa địa chỉ.")
    });
  };

  const removeDestination = (destination) => {
    setConfirmDialog({
      title: "Xóa điểm nhận hoàn cọc?",
      message: `Xóa “${destination.label || "Chưa đặt tên"}”? Các đơn đang xử lý hoàn cọc vẫn dùng bản chụp thông tin đã xác nhận.`,
      action: () => run(`refund-delete-${destination._id}`, () => deleteRefundDestination(destination._id), "Đã xóa điểm nhận hoàn cọc.")
    });
  };

  return <main className="ara-account">
    <header><span>ARA MEMBER CARE</span><h1>Tài khoản của bạn</h1><p>Quản lý thông tin giao nhận, điểm nhận hoàn cọc và số dư cọc bảo lưu.</p></header>
    <nav aria-label="Các mục trong tài khoản">{tabs.map(([key, label, Icon]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon size={17}/>{label}</button>)}</nav>

    {loading && <StateMessage text="Đang tải thông tin tài khoản..." />}
    {!loading && error && <StateMessage text={error} tone="error" actionLabel="Thử lại" onAction={() => load()} />}
    {!loading && !error && <>
      {tab === "profile" && <section className="ara-account-panel">
        <div className="ara-account-title"><div><h2>Thông tin cá nhân</h2><p>Cập nhật thông tin liên hệ dùng cho đơn thuê và giao nhận.</p></div><button onClick={() => setProfileForm({ name: user?.name || user?.fullName || "", phone: user?.phone || "", email: user?.email || "" })}><Edit3 size={16}/>Chỉnh sửa</button></div>
        <div className="ara-account-profile"><p><span>Họ tên</span><strong>{user?.name || user?.fullName || "—"}</strong></p><p><span>Số điện thoại</span><strong>{user?.phone || "—"}</strong></p><p><span>Email</span><strong>{user?.email || "Chưa cập nhật"}</strong></p></div>
      </section>}

      {tab === "addresses" && <section className="ara-account-panel">
        <div className="ara-account-title"><div><h2>Địa chỉ giao nhận</h2><p>Đơn thuê luôn lưu bản chụp địa chỉ tại thời điểm đặt.</p></div><button onClick={() => setAddressForm({})}><Plus size={16}/>Thêm địa chỉ</button></div>
        {addresses.length === 0 ? <AccountEmpty icon={<MapPin size={25}/>} title="Chưa có địa chỉ giao nhận" text="Thêm địa chỉ để điền thông tin giao nhận nhanh hơn khi đặt thuê." action="Thêm địa chỉ" onAction={() => setAddressForm({})}/> : <div className="ara-account-cards">{addresses.map((address) => <article className={!address.isEnabled ? "disabled" : ""} key={address._id}><header><strong>{address.label}</strong>{address.isDefault && <b>Mặc định</b>}</header><h3>{address.receiverName} · {address.receiverPhone}</h3><p>{[address.addressLine, address.wardName, address.districtName, address.provinceName].filter(Boolean).join(", ")}</p><footer>{!address.isDefault && address.isEnabled && <button disabled={Boolean(busyAction)} onClick={() => run(`address-default-${address._id}`, () => setDefaultAddress(address._id), "Đã đặt địa chỉ mặc định.")}><Star size={14}/>Mặc định</button>}<button disabled={Boolean(busyAction)} onClick={() => run(`address-toggle-${address._id}`, () => toggleAddress(address._id), "Đã đổi trạng thái địa chỉ.")}><Power size={14}/>{address.isEnabled ? "Tắt" : "Bật"}</button><button disabled={Boolean(busyAction)} onClick={() => removeAddress(address)}><Trash2 size={14}/>Xóa</button></footer></article>)}</div>}
      </section>}

      {tab === "refund" && <section className="ara-account-panel ara-refund-panel">
        <div className="ara-account-title"><div><span className="ara-account-eyebrow">REFUND DESTINATIONS</span><h2>Điểm nhận hoàn cọc</h2><p>Lưu tài khoản hoặc VietQR để ARA hoàn cọc đúng nơi. Số tài khoản luôn được mã hóa và chỉ hiển thị dạng đã che.</p></div><div className="ara-refund-add-actions"><button className="is-primary" onClick={() => setBankForm({ type: "bank_account" })}><Plus size={16}/>Thêm tài khoản</button><button onClick={() => setBankForm({ type: "vietqr_image" })}><Plus size={16}/>Thêm VietQR</button></div></div>
        {destinations.length === 0 ? <div className="ara-refund-empty"><span><Landmark size={27}/></span><h3>Chưa có điểm nhận hoàn cọc</h3><p>Thêm tài khoản ngân hàng hoặc ảnh VietQR để cửa hàng có thể hoàn cọc nhanh chóng.</p><small><ShieldCheck size={15}/>Thông tin được lưu an toàn và không công khai.</small></div> : <div className="ara-account-cards ara-refund-cards">{destinations.map((destination) => <article className={!destination.isEnabled ? "disabled" : ""} key={destination._id}><header><strong>{destination.label}</strong>{destination.isDefault && <b>Mặc định</b>}</header><div className="ara-refund-card-body">{destination.type === "vietqr_image" && destination.qrAsset?.secureUrl ? <img className="ara-refund-qr-preview" src={destination.qrAsset.secureUrl} alt={destination.label}/> : <span className="ara-refund-bank-icon"><Landmark size={24}/></span>}<div><small>{destination.type === "bank_account" ? "TÀI KHOẢN NGÂN HÀNG" : "ẢNH VIETQR"}</small><h3>{destination.type === "bank_account" ? destination.bankName : "VietQR nhận hoàn cọc"}</h3><p>{destination.type === "bank_account" ? `${destination.accountHolderName} · ${destination.maskedAccountNumber}` : "QR riêng tư đã được lưu an toàn"}</p></div></div><footer>{!destination.isDefault && destination.isEnabled && <button disabled={Boolean(busyAction)} onClick={() => run(`refund-default-${destination._id}`, () => setDefaultRefundDestination(destination._id), "Đã đặt điểm nhận mặc định.")}><Star size={14}/>Mặc định</button>}<button disabled={Boolean(busyAction)} onClick={() => run(`refund-toggle-${destination._id}`, () => toggleRefundDestination(destination._id), "Đã đổi trạng thái điểm nhận.")}><Power size={14}/>{destination.isEnabled ? "Tắt" : "Bật"}</button><button disabled={Boolean(busyAction)} onClick={() => removeDestination(destination)}><Trash2 size={14}/>Xóa</button></footer></article>)}</div>}
      </section>}

      {tab === "credits" && <section className="ara-account-panel"><h2>Số dư cọc bảo lưu</h2><div className="ara-credit-total"><span>Tổng khả dụng</span><strong>{money(credits.reduce((sum, credit) => sum + Number(credit.remainingAmount || 0), 0))}</strong><small>Không có ngày hết hạn</small></div>{credits.length === 0 ? <AccountEmpty icon={<WalletCards size={25}/>} title="Chưa có cọc bảo lưu" text="Các khoản cọc đủ điều kiện bảo lưu sẽ xuất hiện tại đây."/> : <div className="ara-credit-ledger">{credits.map((credit) => <p key={credit._id}><span>Đơn nguồn #{String(credit.sourceOrderId || "").slice(-6).toUpperCase()}</span><strong>{money(credit.remainingAmount)}</strong></p>)}</div>}</section>}
    </>}

    {addressForm && (
      <AddressFormDialog
        onClose={() => setAddressForm(null)}
        onSave={async (body) => {
          const saved = await run("address-create", () => createAddress(body), "Đã thêm địa chỉ.");
          if (saved) setAddressForm(null);
        }}
      />
    )}
    {profileForm && <form ref={profileDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={profileTitleId} className="ara-account-dialog ara-profile-dialog" onSubmit={async (event) => { event.preventDefault(); if (busyAction) return; setBusyAction("profile"); busyActionRef.current = "profile"; try { const updated = await updateProfile(Object.fromEntries(new FormData(event.currentTarget))); onUserUpdated?.(updated); notify?.("Đã cập nhật thông tin cá nhân.", "success"); setProfileForm(null); } catch (profileError) { notify?.(profileError.message || "Không thể cập nhật hồ sơ.", "error"); } finally { busyActionRef.current = ""; setBusyAction(""); } }}><header><span><UserRound/></span><div><small>ARA MEMBER PROFILE</small><h2 id={profileTitleId}>Chỉnh sửa thông tin cá nhân</h2><p>Thông tin mới sẽ được dùng cho các đơn thuê tiếp theo.</p></div></header><label>Họ và tên<input name="name" defaultValue={profileForm.name} required maxLength={100}/></label><label>Số điện thoại<input name="phone" type="tel" defaultValue={profileForm.phone} required/></label><label className="wide">Email (không bắt buộc)<input name="email" type="email" defaultValue={profileForm.email} placeholder="email@example.com"/></label><div><button type="button" onClick={() => setProfileForm(null)} disabled={Boolean(busyAction)}>Hủy</button><button className="is-primary" disabled={Boolean(busyAction)}>{busyAction === "profile" ? "Đang lưu..." : "Lưu thay đổi"}</button></div></form>}
    {bankForm && (
      <RefundDestinationForm
        type={bankForm.type}
        notify={notify}
        onSaved={() => load({ silent: true })}
        onClose={() => setBankForm(null)}
      />
    )}
    {confirmDialog && <div className="ara-confirm-backdrop" onMouseDown={() => setConfirmDialog(null)}><section ref={confirmDialogRef} tabIndex={-1} className="ara-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={confirmTitleId} onMouseDown={(event) => event.stopPropagation()}><span className="ara-confirm-dialog__icon"><AlertTriangle size={21}/></span><div><h2 id={confirmTitleId}>{confirmDialog.title}</h2><p>{confirmDialog.message}</p></div><footer><button type="button" onClick={() => setConfirmDialog(null)} disabled={Boolean(busyAction)}>Hủy</button><button type="button" className="is-danger" onClick={async () => { const action = confirmDialog.action; setConfirmDialog(null); await action(); }} disabled={Boolean(busyAction)}>Xóa</button></footer></section></div>}
  </main>;
}

function AccountEmpty({ icon, title, text, action, onAction }) {
  return <div className="ara-account-empty"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div>;
}
