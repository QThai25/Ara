import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { listCommunes, listDistricts, listProvinces } from "../../services/locationService.js";

const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[.\s-]+/g, " ").trim();

function SearchList({ label, helper, items, value, onChange, multiple = false, disabled = false, placeholder = "Chọn" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = React.useRef(null);
  const selected = multiple ? items.filter((item) => value.includes(item.code)) : items.find((item) => item.code === value);
  const filtered = useMemo(() => items.filter((item) => [item.name, item.displayName, ...(item.aliases || [])].some((text) => normalize(text).includes(normalize(query)))), [items, query]);
  const choose = (item) => {
    if (multiple) onChange(value.includes(item.code) ? value.filter((code) => code !== item.code) : [...value, item.code]);
    else { onChange(item); setOpen(false); setQuery(""); }
  };
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const width = Math.min(rect.width, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
        const menuHeight = 330;
        const top = rect.bottom + menuHeight > window.innerHeight ? Math.max(12, rect.top - menuHeight - 6) : rect.bottom + 6;
        setMenuStyle({ position: "fixed", left, top, width, zIndex: 5000 });
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const width = Math.min(rect.width, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
        const menuHeight = 330;
        const top = rect.bottom + menuHeight > window.innerHeight
          ? Math.max(12, rect.top - menuHeight - 6)
          : rect.bottom + 6;
        setMenuStyle({ position: "fixed", left, top, width, zIndex: 5000 });
      }
    }
    setOpen((current) => !current);
  };
  return <div className="ara-location-control">
    <label>{label}</label><small>{helper}</small>
    <button ref={triggerRef} type="button" disabled={disabled} className="ara-location-trigger" onClick={toggle}>
      <span>{multiple ? (selected.length ? `Đã chọn ${selected.length}` : placeholder) : selected?.displayName || selected?.name || placeholder}</span><ChevronDown size={16}/>
    </button>
    {multiple && selected.length > 0 && <div className="ara-location-chips">{selected.map((item) => <span key={item.code}>{item.displayName || item.name}<button type="button" onClick={() => choose(item)}><X size={12}/></button></span>)}</div>}
    {open && !disabled && createPortal(<div className="ara-location-menu ara-location-menu-portal" style={menuStyle}>
      <div><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Gõ để tìm kiếm..."/></div>
      {multiple && <nav><button type="button" onClick={() => onChange(items.map((item) => item.code))}>Chọn tất cả</button><button type="button" onClick={() => onChange([])}>Bỏ chọn tất cả</button></nav>}
      <section>{filtered.length ? filtered.map((item) => <button type="button" key={item.code} className={(multiple ? value.includes(item.code) : value === item.code) ? "selected" : ""} onClick={() => choose(item)}>{item.displayName || item.name}{(multiple ? value.includes(item.code) : value === item.code) && <Check size={14}/>}</button>) : <p>Không tìm thấy kết quả phù hợp.</p>}</section>
    </div>, document.body)}
  </div>;
}

export function AddressLocationSelector({
  provinceCode,
  districtCodes = [],
  communeCodes = [],
  coverageType = "selected_communes",
  onProvinceChange,
  onDistrictCodesChange,
  onCommuneCodesChange,
  onCoverageTypeChange
}) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    listProvinces()
      .then((result) => { setProvinces(result.data?.items || []); setLoadError(""); })
      .catch(() => setLoadError("Không tải được danh sách tỉnh/thành phố."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!provinceCode) { setDistricts([]); return; }
    listDistricts(provinceCode)
      .then((result) => { setDistricts(result.data?.items || []); setLoadError(""); })
      .catch(() => setLoadError("Không tải được danh sách quận/huyện."));
  }, [provinceCode]);
  useEffect(() => {
    if (!provinceCode || !districtCodes.length) { setCommunes([]); return; }
    listCommunes(provinceCode, districtCodes)
      .then((result) => { setCommunes(result.data?.items || []); setLoadError(""); })
      .catch(() => setLoadError("Không tải được danh sách phường/xã."));
  }, [provinceCode, districtCodes.join(",")]);
  useEffect(() => {
    if (!communeCodes.length) return;
    const valid = new Set(communes.map((item) => item.code));
    const next = communeCodes.filter((code) => valid.has(code));
    if (next.length !== communeCodes.length) onCommuneCodesChange(next);
  }, [communes]);

  return <div className="ara-address-location-selector">
    <SearchList label="Tỉnh/thành phố" helper={loading ? "Đang tải danh sách..." : "Gõ để tìm và chọn tỉnh/thành phố trong danh sách."} items={provinces} value={provinceCode} disabled={loading} placeholder="Chọn tỉnh/thành phố" onChange={onProvinceChange}/>
    <SearchList label="Quận/huyện áp dụng" helper="Chọn quận/huyện để thu hẹp khu vực giao nhận. Có thể chọn nhiều khu vực." items={districts} value={districtCodes} onChange={onDistrictCodesChange} multiple disabled={!provinceCode} placeholder={provinceCode ? "Chọn quận/huyện" : "Vui lòng chọn tỉnh/thành phố trước"}/>
    <div className="ara-coverage-choice"><label>Phạm vi giao nhận</label><small>Chọn cấp áp dụng phù hợp với khu vực vận hành.</small><div>
      <button type="button" className={coverageType === "entire_province" ? "selected" : ""} onClick={() => onCoverageTypeChange("entire_province")}>Toàn bộ tỉnh/thành phố</button>
      <button type="button" disabled={!districtCodes.length} className={coverageType === "selected_districts" ? "selected" : ""} onClick={() => onCoverageTypeChange("selected_districts")}>Theo quận/huyện đã chọn</button>
      <button type="button" disabled={!districtCodes.length} className={coverageType === "selected_communes" ? "selected" : ""} onClick={() => onCoverageTypeChange("selected_communes")}>Chỉ một số phường/xã</button>
    </div></div>
    {coverageType === "selected_communes" && <SearchList label="Phường/xã được hỗ trợ" helper="Danh sách được lọc theo quận/huyện đã chọn." items={communes} value={communeCodes} onChange={onCommuneCodesChange} multiple disabled={!districtCodes.length} placeholder={districtCodes.length ? "Chọn phường/xã" : "Vui lòng chọn quận/huyện trước"}/>}
    {loadError && <p className="ara-location-error" role="alert">{loadError}</p>}
  </div>;
}
