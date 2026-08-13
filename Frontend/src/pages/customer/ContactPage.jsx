import React, { useState } from "react";
import { Clock3, Facebook, Instagram, MapPin, Phone, Send } from "lucide-react";
import { createContactRequest } from "../../services/contactService.js";

const emptyForm = { name: "", phone: "", need: "", date: "", note: "", website: "" };

export function ContactPage({ notify }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      await createContactRequest(form);
      notify?.("ARA đã nhận yêu cầu tư vấn của bạn.");
      setForm(emptyForm);
    } catch (error) { notify?.(error.message || "Không thể gửi yêu cầu tư vấn.", "error"); }
    finally { setBusy(false); }
  };

  return <div className="luxury-contact-page">
    <section className="luxury-contact-hero"><span>PERSONAL STYLING · ARA</span><h1>Liên hệ<br/>tư vấn riêng</h1><p>Để ARA cùng bạn chọn thiết kế phù hợp nhất cho buổi tiệc, ngày trọng đại hay bộ ảnh đáng nhớ.</p><div className="luxury-contact-meta"><a href="tel:0364019798"><Phone size={18}/><div><small>HOTLINE</small><strong>036 401 9798</strong></div></a><a href="https://www.google.com/maps/place/41%2F1+Nguy%E1%BB%85n+B%E1%BB%89nh+Khi%C3%AAm,+T%C3%A2n+%C4%90%E1%BB%8Bnh,+H%E1%BB%93+Ch%C3%AD+Minh+71050,+Vi%E1%BB%87t+Nam/@10.7906485,106.7010865,17z/data=!3m1!4b1!4m6!3m5!1s0x317528b56bb113e9:0x30a985cce86c3187!8m2!3d10.7906485!4d106.7010865!16s%2Fg%2F11kqnz42k0?entry=ttu&g_ep=EgoyMDI2MDcyOS4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noreferrer"><MapPin size={18}/><div><small>SHOWROOM</small><strong>41/1 Nguyễn Bỉnh Khiêm, Phường Đa Kao, Quận 1, Thành phố Hồ Chí Minh</strong></div></a><div><Clock3 size={18}/><div><small>GIỜ TƯ VẤN</small><strong>09:00 — 21:00</strong></div></div></div><div className="luxury-contact-social"><a href="https://www.facebook.com/share/1L3WXUML8x/?mibextid=wwXIfrm" target="_blank" rel="noreferrer"><Facebook size={17}/> Facebook</a><a href="https://www.instagram.com/ara.thuedosg" target="_blank" rel="noreferrer"><Instagram size={17}/> Instagram</a></div></section>
    <section className="luxury-contact-form-wrap"><header><span>BOOK A CONSULTATION</span><h2>ARA có thể giúp gì cho bạn?</h2><p>Vui lòng điền đầy đủ thông tin, đội ngũ ARA sẽ liên hệ tư vấn sớm nhất.</p></header><form onSubmit={submit}><input className="contact-honeypot" tabIndex="-1" autoComplete="off" aria-hidden="true" value={form.website} onChange={field("website")}/><div className="luxury-contact-fields"><label>Họ và tên *<input value={form.name} onChange={field("name")} required minLength="2" maxLength="120" placeholder="Tên của bạn"/></label><label>Số điện thoại *<input type="tel" inputMode="tel" value={form.phone} onChange={field("phone")} required pattern="0(3|5|7|8|9)[0-9]{8}" placeholder="0901234567"/></label><label>Nhu cầu thuê *<input value={form.need} onChange={field("need")} required minLength="3" maxLength="300" placeholder="Dạ hội, tiệc cưới, chụp ảnh..."/></label><label>Ngày dự kiến *<input type="date" value={form.date} onChange={field("date")} required/></label></div><label>Điều bạn muốn ARA tư vấn *<textarea value={form.note} onChange={field("note")} required minLength="10" maxLength="2000" placeholder="Phong cách, màu sắc, số đo hoặc yêu cầu đặc biệt..."/></label><small className="contact-form-note">Tất cả trường đều bắt buộc. Mỗi thiết bị chỉ có thể gửi tối đa 5 yêu cầu trong 15 phút.</small><button disabled={busy}><span>{busy ? "Đang gửi..." : "Gửi yêu cầu tư vấn"}</span><Send size={17}/></button></form></section>
  </div>;
}
