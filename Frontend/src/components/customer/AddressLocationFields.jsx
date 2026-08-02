import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { createPortal } from "react-dom";
import { listCommunes, listDistricts, listProvinces } from "../../services/locationService.js";

const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").trim();

const getMenuPosition = (element) => {
  const rect = element?.getBoundingClientRect();
  if (!rect) return null;

  const viewportGap = 12;
  const menuGap = 6;
  const width = Math.min(rect.width, window.innerWidth - viewportGap * 2);
  const left = Math.max(viewportGap, Math.min(rect.left, window.innerWidth - width - viewportGap));
  const availableHeight = Math.max(96, window.innerHeight - rect.bottom - viewportGap - menuGap);

  return {
    position: "fixed",
    left,
    top: rect.bottom + menuGap,
    width,
    maxHeight: Math.min(330, availableHeight),
    zIndex: 5000,
  };
};

function LocationSelect({ label, value, items, placeholder, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({});
  const trigger = useRef(null);
  const selected = items.find((item) => item.code === value);
  const filtered = useMemo(() => items.filter((item) => normalize(item.displayName || item.name).includes(normalize(query))), [items, query]);

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const nextPosition = getMenuPosition(trigger.current);
      if (nextPosition) setPosition(nextPosition);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  const toggle = () => {
    if (!open) {
      const nextPosition = getMenuPosition(trigger.current);
      if (nextPosition) setPosition(nextPosition);
    }
    setOpen((current) => !current);
  };

  return <label className="ara-customer-location-field">
    <span>{label} *</span>
    <button ref={trigger} type="button" className="ara-customer-location-trigger" disabled={disabled} onClick={toggle}>
      <span>{selected?.displayName || selected?.name || placeholder}</span><ChevronDown size={17}/>
    </button>
    {open && !disabled && createPortal(<div className="ara-customer-location-menu" style={position}>
      <div className="ara-customer-location-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Gõ để tìm kiếm..."/></div>
      <div className="ara-customer-location-options">
        {filtered.length ? filtered.map((item) => <button type="button" key={item.code} className={item.code === value ? "selected" : ""} onClick={() => {
          onChange(item);
          setOpen(false);
          setQuery("");
        }}><span>{item.displayName || item.name}</span>{item.code === value && <Check size={15}/>}</button>) : <p>Không tìm thấy vị trí phù hợp.</p>}
      </div>
    </div>, document.body)}
  </label>;
}

export function AddressLocationFields({ provinceCode, districtCode, communeCode, onChange, allowedProvinceCodes = null }) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listProvinces().then((result) => {
      const items = result.data?.items || [];
      setProvinces(Array.isArray(allowedProvinceCodes) ? items.filter((item) => allowedProvinceCodes.includes(String(item.code))) : items);
    }).catch(() => setError("Không tải được danh sách tỉnh/thành phố."));
  }, [allowedProvinceCodes?.join(",")]);
  useEffect(() => {
    if (!provinceCode) { setDistricts([]); return; }
    listDistricts(provinceCode).then((result) => { setDistricts(result.data?.items || []); setError(""); }).catch(() => { setDistricts([]); setError("Không tải được danh sách quận/huyện."); });
  }, [provinceCode]);
  useEffect(() => {
    if (!provinceCode || !districtCode) { setCommunes([]); return; }
    listCommunes(provinceCode, [districtCode]).then((result) => { setCommunes(result.data?.items || []); setError(""); }).catch(() => { setCommunes([]); setError("Không tải được danh sách phường/xã."); });
  }, [provinceCode, districtCode]);

  return <>
    <LocationSelect label="Tỉnh / thành phố" value={provinceCode} items={provinces} placeholder="Chọn tỉnh/thành phố" onChange={(item) => onChange({ provinceCode: item.code, provinceName: item.name, districtCode: "", districtName: "", communeCode: "", communeName: "" })}/>
    <LocationSelect label="Quận / huyện" value={districtCode} items={districts} disabled={!provinceCode} placeholder={provinceCode ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"} onChange={(item) => onChange({ districtCode: item.code, districtName: item.displayName || item.name, communeCode: "", communeName: "" })}/>
    <LocationSelect label="Phường / xã" value={communeCode} items={communes} disabled={!districtCode} placeholder={districtCode ? "Chọn phường/xã" : "Chọn quận/huyện trước"} onChange={(item) => onChange({ communeCode: item.code, communeName: item.name })}/>
    {error && <p className="address-location-error" role="alert">{error}</p>}
  </>;
}
