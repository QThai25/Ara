import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const normalizeOptions = (options = []) => options.map((option) => Array.isArray(option)
  ? { value: option[0], label: option[1] }
  : { value: option?.value, label: option?.label || option?.name }
).filter((option) => option.value !== undefined && option.label);

function usePortalPosition(open, triggerRef, width = null) {
  const [style, setStyle] = useState({});
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const update = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const padding = 10, gap = 7;
      const menuWidth = Math.min(width || rect.width, window.innerWidth - padding * 2);
      const left = Math.max(padding, Math.min(rect.left, window.innerWidth - menuWidth - padding));
      const below = window.innerHeight - rect.bottom - gap - padding;
      const above = rect.top - gap - padding;
      const opensUp = below < 230 && above > below;
      setStyle({ position: "fixed", width: menuWidth, left, maxHeight: Math.min(330, Math.max(180, opensUp ? above : below)), ...(opensUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, triggerRef, width]);
  return style;
}

export function ModalSelect({ label, value, options = [], onChange, placeholder = "Chọn một giá trị", disabled = false, clearable = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null), triggerRef = useRef(null), menuRef = useRef(null);
  const menuStyle = usePortalPosition(open, triggerRef);
  const normalized = useMemo(() => normalizeOptions(options), [options]);
  const selected = normalized.find((option) => String(option.value) === String(value ?? ""));
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
      if (event.type === "pointerdown" && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close); window.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  const choose = (next) => { onChange(next); setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); };
  return <label className={`modal-select-field ${className}`} ref={rootRef}>
    {label && <span className="admin-control-label">{label}</span>}
    <button ref={triggerRef} type="button" className={`modal-select-trigger ${open ? "is-open" : ""} ${selected ? "" : "is-placeholder"}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{selected?.label || placeholder}</span><ChevronDown size={17}/></button>
    {open && createPortal(<div ref={menuRef} className="modal-select-menu" style={menuStyle} role="listbox" aria-label={label || placeholder}>
      {clearable && <button type="button" role="option" aria-selected={!selected} className={!selected ? "is-selected" : ""} onClick={() => choose("")}><span>{placeholder}</span>{!selected && <CheckCircle2 size={16}/>}</button>}
      {!normalized.length && <p>Không có lựa chọn</p>}
      {normalized.map((option) => { const active = String(option.value) === String(value ?? ""); return <button type="button" role="option" aria-selected={active} className={active ? "is-selected" : ""} key={String(option.value)} onClick={() => choose(option.value)}><span>{option.label}</span>{active && <CheckCircle2 size={16}/>}</button>; })}
    </div>, document.body)}
  </label>;
}

export function ModalMultiSelect({ label, value = [], options = [], onChange, placeholder = "Chọn một hoặc nhiều giá trị", disabled = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null), triggerRef = useRef(null), menuRef = useRef(null);
  const menuStyle = usePortalPosition(open, triggerRef);
  const normalized = useMemo(() => normalizeOptions(options), [options]);
  const selectedIds = useMemo(() => new Set((Array.isArray(value) ? value : []).map(String)), [value]);
  const selected = normalized.filter((option) => selectedIds.has(String(option.value)));
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
      if (event.type === "pointerdown" && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close); window.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  const toggle = (next) => {
    const identity = String(next);
    onChange(selectedIds.has(identity)
      ? (Array.isArray(value) ? value : []).filter((item) => String(item) !== identity)
      : [...(Array.isArray(value) ? value : []), next]);
  };
  const remove = (event, identity) => {
    event.stopPropagation();
    onChange((Array.isArray(value) ? value : []).filter((item) => String(item) !== String(identity)));
  };
  return <label className={`modal-select-field modal-multi-select-field ${className}`} ref={rootRef}>
    {label && <span className="admin-control-label">{label}</span>}
    <button ref={triggerRef} type="button" className={`modal-select-trigger modal-multi-select-trigger ${open ? "is-open" : ""} ${selected.length ? "" : "is-placeholder"}`} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className="modal-multi-select-values">{selected.length ? selected.map((option) => <span className="modal-multi-select-chip" key={String(option.value)}>{option.label}<span role="button" tabIndex={-1} aria-label={`Bỏ ${option.label}`} onClick={(event) => remove(event, option.value)}><X size={13}/></span></span>) : placeholder}</span>
      <ChevronDown size={17}/>
    </button>
    {open && createPortal(<div ref={menuRef} className="modal-select-menu modal-multi-select-menu" style={menuStyle} role="listbox" aria-multiselectable="true" aria-label={label || placeholder}>
      {!normalized.length && <p>Không có lựa chọn</p>}
      {normalized.map((option) => { const active = selectedIds.has(String(option.value)); return <button type="button" role="option" aria-selected={active} className={active ? "is-selected" : ""} key={String(option.value)} onClick={() => toggle(option.value)}><span>{option.label}</span>{active && <CheckCircle2 size={16}/>}</button>; })}
    </div>, document.body)}
  </label>;
}

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const parse = (value) => { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || ""); return match ? new Date(Number(match[1]), Number(match[2])-1, Number(match[3])) : null; };
const displayDate = (value) => { const date = parse(value); return date ? `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}` : ""; };

export function ModalDatePicker({ label, value, onChange, placeholder = "Chọn ngày", minDate, maxDate, disabled = false }) {
  const selected = parse(value), today = new Date(); today.setHours(0,0,0,0);
  const [open,setOpen]=useState(false),[view,setView]=useState(selected || today);
  const rootRef=useRef(null),triggerRef=useRef(null),menuRef=useRef(null),style=usePortalPosition(open,triggerRef,336);
  useEffect(()=>{if(selected)setView(selected);},[value]);
  useEffect(()=>{if(!open)return;const close=e=>{if(e.key==="Escape"){setOpen(false);triggerRef.current?.focus();}if(e.type==="pointerdown"&&!rootRef.current?.contains(e.target)&&!menuRef.current?.contains(e.target))setOpen(false);};document.addEventListener("pointerdown",close);window.addEventListener("keydown",close);return()=>{document.removeEventListener("pointerdown",close);window.removeEventListener("keydown",close);};},[open]);
  const start=new Date(view.getFullYear(),view.getMonth(),1), offset=(start.getDay()+6)%7, cells=Array.from({length:42},(_,i)=>new Date(view.getFullYear(),view.getMonth(),i-offset+1));
  const blocked=date=>(minDate&&iso(date)<minDate)||(maxDate&&iso(date)>maxDate);
  const choose=date=>{if(blocked(date))return;onChange(iso(date));setOpen(false);requestAnimationFrame(()=>triggerRef.current?.focus());};
  return <label className="modal-date-field" ref={rootRef}><span className="admin-control-label">{label}</span><button ref={triggerRef} type="button" disabled={disabled} className={`modal-date-trigger ${open?"is-open":""}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span className={value?"":"placeholder"}>{displayDate(value)||placeholder}</span><CalendarDays size={17}/></button>
    {open&&createPortal(<div ref={menuRef} className="modal-date-popover" style={style} role="dialog" aria-modal="false" aria-label={label}><header><strong>Tháng {view.getMonth()+1}, {view.getFullYear()}</strong><div><button type="button" aria-label="Tháng trước" onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()-1,1))}><ChevronLeft size={17}/></button><button type="button" aria-label="Tháng sau" onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()+1,1))}><ChevronRight size={17}/></button></div></header><div className="modal-date-week">{["T2","T3","T4","T5","T6","T7","CN"].map(day=><span key={day}>{day}</span>)}</div><div className="modal-date-grid">{cells.map(date=>{const key=iso(date),outside=date.getMonth()!==view.getMonth(),active=key===value,isToday=key===iso(today),isDisabled=blocked(date);return <button type="button" key={key} disabled={isDisabled} className={`${outside?"outside":""} ${active?"selected":""} ${isToday?"today":""}`} onClick={()=>choose(date)}>{date.getDate()}</button>;})}</div><footer><button type="button" onClick={()=>{onChange("");setOpen(false);}}>Xóa ngày</button><button type="button" disabled={blocked(today)} onClick={()=>choose(today)}>Hôm nay</button></footer></div>,document.body)}
  </label>;
}

export function PlainNumberInput({ label, value, onChange = () => {}, min, max, suffix = "", required = false, placeholder = "0", readOnly = false }) {
  const change=(raw)=>{let next=raw.replace(/\D/g,"");if(next!==""){let n=Number(next);if(min!==undefined)n=Math.max(min,n);if(max!==undefined)n=Math.min(max,n);next=String(n);}onChange(next);};
  return <label className="plain-number-field"><span className="admin-control-label">{label}</span><span className="admin-input-shell"><input type="text" inputMode="numeric" required={required} readOnly={readOnly} value={value ?? ""} placeholder={placeholder} onFocus={e=>e.currentTarget.select()} onChange={e=>change(e.target.value)}/>{suffix&&<b>{suffix}</b>}</span></label>;
}

export function MoneyThousandsInput({ label, value, onChange = () => {}, required = false, readOnly = false }) {
  const units=value===""||value===null||value===undefined?"":String(Math.round(Number(value)/1000));
  return <label className="money-thousands-field"><span className="admin-control-label">{label}</span><span className="admin-input-shell"><input type="text" inputMode="numeric" required={required} readOnly={readOnly} value={units} placeholder="Ví dụ: 700" onFocus={e=>e.currentTarget.select()} onChange={e=>{const raw=e.target.value.replace(/\D/g,"");onChange(raw===""?"":Number(raw)*1000);}}/><b>.000 đ</b></span>{units&&<small>Thành tiền: {new Intl.NumberFormat("vi-VN").format(Number(value))} đ</small>}</label>;
}

export function AdminModal({ title, children, onClose, className = "" }) {
  useEffect(()=>{const close=e=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",close);const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{window.removeEventListener("keydown",close);document.body.style.overflow=previous;};},[onClose]);
  return createPortal(<div className="admin-modal-backdrop" role="presentation" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className={`admin-modal ${className}`} role="dialog" aria-modal="true" aria-label={title}><header className="admin-modal-head"><h2>{title}</h2><button type="button" aria-label="Đóng" onClick={onClose}><X size={20}/></button></header><div className="admin-modal-body">{children}</div></section></div>,document.body);
}
