import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, Landmark, UploadCloud, X } from "lucide-react";
import { createRefundDestination, uploadRefundQr } from "../../services/accountService.js";

export function RefundDestinationForm({ type, onClose, onSaved, notify }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);
  const qr = type === "vietqr_image";

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = event => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) {
      notify?.("Ảnh QR chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP.", "error");
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      notify?.("Ảnh QR không được vượt quá 5MB.", "error");
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
      let body = { type, label: values.label };
      if (qr) {
        if (!file) throw new Error("Vui lòng chọn ảnh QR.");
        const asset = await uploadRefundQr(file);
        body.qrAsset = { publicId: asset.publicId, secureUrl: asset.secureUrl || asset.url, mimeType: asset.mimeType || file.type };
      } else {
        body = { ...body, bankCode: values.bankCode, bankName: values.bankName, accountNumber: values.accountNumber, accountHolderName: values.accountHolderName };
      }
      await createRefundDestination(body);
      notify?.("Đã thêm điểm nhận hoàn cọc.", "success");
      await onSaved?.();
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
      <div><small>ARA REFUND DESTINATION</small><h2>{qr ? "Thêm ảnh VietQR" : "Thêm tài khoản ngân hàng"}</h2><p>{qr ? "Tải ảnh QR nhận tiền để ARA hoàn cọc chính xác và thuận tiện." : "Thông tin này chỉ được sử dụng để hoàn cọc cho bạn."}</p></div>
    </header>
    <label className="ara-refund-dialog-field">Tên gợi nhớ<input name="label" required maxLength={80} placeholder={qr ? "Ví dụ: QR MB Bank" : "Ví dụ: Tài khoản chính"}/></label>
    {qr ? <div className={`ara-refund-qr-upload${preview ? " has-preview" : ""}`} role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={event => { if (["Enter", " "].includes(event.key)) inputRef.current?.click(); }}>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={choose}/>
      {preview ? <><img src={preview} alt="Xem trước QR"/><div><strong>{file?.name}</strong><small>Nhấn để chọn ảnh khác</small></div></> : <><span><UploadCloud size={30}/></span><strong>Kéo thả hoặc chọn ảnh QR</strong><small>PNG, JPG, JPEG hoặc WEBP · tối đa 5MB</small></>}
    </div> : <div className="ara-refund-bank-fields">{[["bankCode","Mã ngân hàng"],["bankName","Tên ngân hàng"],["accountNumber","Số tài khoản"],["accountHolderName","Chủ tài khoản"]].map(([name,label]) => <label className="ara-refund-dialog-field" key={name}>{label}<input name={name} required autoComplete="off"/></label>)}</div>}
    <footer className="ara-refund-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="is-primary" disabled={busy || (qr && !file)}>{busy ? "Đang lưu…" : "Lưu điểm nhận"}</button></footer>
  </form>;
}
