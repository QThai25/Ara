import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ImagePlus, Landmark, Search, UploadCloud, X } from "lucide-react";
import { createRefundDestination, listSupportedBanks, uploadRefundQr } from "../../services/accountService.js";

export function RefundDestinationForm({ type, onClose, onSaved, notify, saveDestination, requestConfig = {}, saveToProfile = true }) {
  const qr = type === "vietqr_image";
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState(null);
  const [banks, setBanks] = useState([]);
  const [bankError, setBankError] = useState("");
  const [banksLoading, setBanksLoading] = useState(!qr);
  const [bankQuery, setBankQuery] = useState("");
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankMenuOpen, setBankMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const bankPickerRef = useRef(null);

  useEffect(() => {
    if (qr) return;
    let active = true;
    setBanksLoading(true);
    listSupportedBanks().then(items => { if (active) { setBanks(items || []); setBankError(""); } }).catch(error => { if (active) setBankError(error.message); }).finally(() => { if (active) setBanksLoading(false); });
    return () => { active = false; };
  }, [qr]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    const closeBankMenu = event => {
      if (!bankPickerRef.current?.contains(event.target)) setBankMenuOpen(false);
    };
    document.addEventListener("mousedown", closeBankMenu);
    return () => document.removeEventListener("mousedown", closeBankMenu);
  }, []);

  const normalizedBankQuery = bankQuery.trim().toLocaleLowerCase("vi");
  const filteredBanks = banks.filter(bank => !normalizedBankQuery ||
    `${bank.shortName || ""} ${bank.name || ""} ${bank.bin || ""}`.toLocaleLowerCase("vi").includes(normalizedBankQuery));
  const pickBank = bank => {
    setSelectedBank(bank);
    setBankQuery("");
    setBankMenuOpen(false);
  };

  const choose = event => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) {
      notify?.("Ảnh QR chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP.", "error");
      return;
    }
    if (next.size > 3 * 1024 * 1024) {
      notify?.("Ảnh QR không được vượt quá 3MB.", "error");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const submit = async event => {
    event.preventDefault();
    try {
      setBusy(true);
      const values = Object.fromEntries(new FormData(event.currentTarget));
      let body = { type: "bank_account", label: values.label, isDefault: values.isDefault === "on" };
      if (qr) {
        if (!file) throw new Error("Vui lòng chọn ảnh QR.");
        const decoded = await uploadRefundQr(file, requestConfig);
        body = { ...body, bankBin: decoded.bankBin, bankCode: decoded.bankCode, bankName: decoded.bankName, accountNumber: decoded.accountNumber, accountName: values.accountName, inputMethod: "uploaded_vietqr" };
      } else {
        if (!selectedBank?.bin) throw new Error("Vui lòng chọn ngân hàng nhận hoàn cọc.");
        body = { ...body, bankBin: selectedBank.bin, accountNumber: values.accountNumber, accountName: values.accountHolderName, inputMethod: "manual" };
      }
      const createdDestination = saveDestination ? await saveDestination(body) : await createRefundDestination(body);
      notify?.("Đã thêm điểm nhận hoàn cọc.", "success");
      await onSaved?.(createdDestination);
      onClose();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return <form className="ara-account-dialog ara-refund-destination-dialog" onSubmit={submit}>
    <button className="ara-refund-dialog-close" type="button" aria-label="Đóng" onClick={onClose}><X size={19}/></button>
    <header className="ara-refund-dialog-header">
      <span>{qr ? <ImagePlus/> : <Landmark/>}</span>
      <div><small>THÔNG TIN NHẬN HOÀN CỌC</small><h2>{qr ? "Tải mã VietQR nhận tiền" : "Thêm tài khoản ngân hàng"}</h2><p>{qr ? "Dùng mã VietQR của tài khoản bạn muốn nhận lại tiền cọc." : "ARA chỉ dùng thông tin này để trả lại tiền cọc cho bạn."}</p></div>
    </header>
    {saveToProfile && <label className="ara-refund-dialog-field">Tên gợi nhớ<input name="label" required maxLength={80} placeholder={qr ? "Ví dụ: QR MB Bank" : "Ví dụ: Tài khoản chính"}/></label>}
    {qr ? <><div className={`ara-refund-qr-upload${preview ? " has-preview" : ""}`} role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={event => { if (["Enter", " "].includes(event.key)) inputRef.current?.click(); }}>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={choose}/>
      {preview ? <><img src={preview} alt="Xem trước QR"/><div><strong>{file?.name}</strong><small>Nhấn để chọn ảnh khác</small></div></> : <><span><UploadCloud size={30}/></span><strong>Kéo thả hoặc chọn ảnh QR</strong><small>PNG, JPG, JPEG hoặc WEBP · tối đa 3MB</small></>}
    </div><p className="ara-refund-qr-help">Chọn mã QR nhận tiền từ ứng dụng ngân hàng của bạn. Không dùng mã QR thanh toán đơn thuê.</p><label className="ara-refund-dialog-field">Tên chủ tài khoản<input name="accountName" required autoComplete="name" placeholder="Ví dụ: NGUYEN VAN AN"/></label></> : <div className="ara-refund-bank-fields">
      <div className="ara-refund-dialog-field ara-refund-bank-select"><span>Ngân hàng</span>
        <div className={`ara-bank-combobox${bankMenuOpen ? " is-open" : ""}`} ref={bankPickerRef}>
          <button type="button" className="ara-bank-combobox-trigger" disabled={banksLoading || Boolean(bankError)} aria-haspopup="listbox" aria-expanded={bankMenuOpen} onClick={() => setBankMenuOpen(open => !open)}>
            <span>{banksLoading ? "Đang tải danh sách ngân hàng…" : selectedBank ? <><strong>{selectedBank.shortName}</strong><small>{selectedBank.name}</small></> : "Chọn ngân hàng"}</span><ChevronDown size={18}/>
          </button>
          {bankMenuOpen && <div className="ara-bank-combobox-menu">
            <div className="ara-bank-combobox-search"><Search size={17}/><input autoFocus value={bankQuery} onChange={event => setBankQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setBankMenuOpen(false); if (event.key === "Enter" && filteredBanks.length) { event.preventDefault(); pickBank(filteredBanks[0]); } }} placeholder="Tìm theo tên hoặc mã ngân hàng…" aria-label="Tìm ngân hàng"/></div>
            <div className="ara-bank-combobox-options" role="listbox">
              {filteredBanks.map(bank => <button type="button" role="option" aria-selected={selectedBank?.bin === bank.bin} className={selectedBank?.bin === bank.bin ? "is-selected" : ""} key={bank.bin} onClick={() => pickBank(bank)}><span><strong>{bank.shortName}</strong><small>{bank.name}</small></span>{selectedBank?.bin === bank.bin && <Check size={17}/>}</button>)}
              {!filteredBanks.length && <p>Không tìm thấy ngân hàng phù hợp.</p>}
            </div>
          </div>}
        </div>
        {bankError && <small className="ara-refund-field-error">{bankError}</small>}
      </div>
      <label className="ara-refund-dialog-field">Số tài khoản<input name="accountNumber" required inputMode="numeric" autoComplete="off" minLength={6} maxLength={24} placeholder="Nhập số tài khoản"/></label>
      <label className="ara-refund-dialog-field">Tên chủ tài khoản<input name="accountHolderName" required autoComplete="name" maxLength={100} placeholder="Ví dụ: NGUYEN VAN AN"/></label>
    </div>}
    {saveToProfile && <label className="ara-refund-default-choice"><input type="checkbox" name="isDefault"/><span>Lưu làm tài khoản nhận hoàn cọc mặc định</span></label>}
    <footer className="ara-refund-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="is-primary" disabled={busy || (qr && !file) || (!qr && (banksLoading || Boolean(bankError) || !selectedBank))}>{busy ? "Đang lưu…" : "Lưu tài khoản"}</button></footer>
  </form>;
}
