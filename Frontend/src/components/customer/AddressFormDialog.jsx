import React, { useState } from "react";
import { AddressLocationFields } from "./AddressLocationFields.jsx";

export function AddressFormDialog({ onClose, onSave }) {
  const [form, setForm] = useState({
    label: "",
    receiverName: "",
    receiverPhone: "",
    addressLine: "",
    provinceCode: "",
    provinceName: "",
    districtCode: "",
    districtName: "",
    communeCode: "",
    communeName: ""
  });

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  return (
    <form className="ara-account-dialog" onSubmit={(event) => {
      event.preventDefault();
      onSave({
        ...form,
        wardCode: form.communeCode,
        wardName: form.communeName,
        districtCode: form.districtCode,
        districtName: form.districtName
      });
    }}>
      <h2>Thêm địa chỉ giao nhận</h2>
      <p className="ara-address-dialog-intro">Chọn đúng khu vực để ARA kiểm tra phạm vi giao nhận và tính thời gian vận chuyển.</p>
      <label>Tên gợi nhớ<input value={form.label} onChange={update("label")} required /></label>
      <label>Người nhận<input value={form.receiverName} onChange={update("receiverName")} required /></label>
      <label>Số điện thoại<input type="tel" value={form.receiverPhone} onChange={update("receiverPhone")} required /></label>
      <AddressLocationFields
        provinceCode={form.provinceCode}
        districtCode={form.districtCode}
        communeCode={form.communeCode}
        onChange={(next) => setForm((current) => ({ ...current, ...next }))}
      />
      <label>Số nhà, tên đường<input value={form.addressLine} onChange={update("addressLine")} required /></label>
      <div className="ara-address-dialog-actions">
        <button type="button" onClick={onClose}>Hủy</button>
        <button>Lưu địa chỉ</button>
      </div>
    </form>
  );
}
