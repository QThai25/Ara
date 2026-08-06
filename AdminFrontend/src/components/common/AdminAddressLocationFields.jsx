import React, { useEffect, useState } from "react";
import { listCommunes, listDistricts, listProvinces } from "../../services/locationService.js";

const itemsFrom = (result) => result.data?.items || [];

export function AdminAddressLocationFields({ provinceCode, districtCode, communeCode, allowedProvinceCodes = [], onChange }) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listProvinces()
      .then((result) => {
        const next = itemsFrom(result);
        setProvinces(allowedProvinceCodes.length ? next.filter((item) => allowedProvinceCodes.includes(String(item.code))) : next);
        setError("");
      })
      .catch(() => setError("Không tải được danh sách tỉnh/thành phố."));
  }, [allowedProvinceCodes.join(",")]);

  useEffect(() => {
    if (!provinceCode) {
      setDistricts([]);
      return;
    }
    listDistricts(provinceCode)
      .then((result) => { setDistricts(itemsFrom(result)); setError(""); })
      .catch(() => { setDistricts([]); setError("Không tải được danh sách quận/huyện."); });
  }, [provinceCode]);

  useEffect(() => {
    if (!provinceCode || !districtCode) {
      setCommunes([]);
      return;
    }
    listCommunes(provinceCode, [districtCode])
      .then((result) => { setCommunes(itemsFrom(result)); setError(""); })
      .catch(() => { setCommunes([]); setError("Không tải được danh sách phường/xã."); });
  }, [provinceCode, districtCode]);

  const optionLabel = (item) => item.displayName || item.name;

  return <>
    <label>Tỉnh/thành phố
      <select required value={provinceCode || ""} onChange={(event) => {
        const value = event.target.value;
        const selected = provinces.find((item) => String(item.code) === value);
        onChange({ provinceCode: value, provinceName: selected ? optionLabel(selected) : "", districtCode: "", districtName: "", communeCode: "", communeName: "", wardName: "" });
      }}>
        <option value="">Chọn tỉnh/thành phố</option>
        {provinces.map((item) => <option key={item.code} value={item.code}>{optionLabel(item)}</option>)}
      </select>
    </label>
    <label>Quận/huyện
      <select required value={districtCode || ""} disabled={!provinceCode} onChange={(event) => {
        const value = event.target.value;
        const selected = districts.find((item) => String(item.code) === value);
        onChange({ districtCode: value, districtName: selected ? optionLabel(selected) : "", communeCode: "", communeName: "", wardName: "" });
      }}>
        <option value="">{provinceCode ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"}</option>
        {districts.map((item) => <option key={item.code} value={item.code}>{optionLabel(item)}</option>)}
      </select>
    </label>
    <label>Phường/xã
      <select required value={communeCode || ""} disabled={!districtCode} onChange={(event) => {
        const value = event.target.value;
        const selected = communes.find((item) => String(item.code) === value);
        onChange({ communeCode: value, communeName: selected ? optionLabel(selected) : "", wardName: selected ? optionLabel(selected) : "" });
      }}>
        <option value="">{districtCode ? "Chọn phường/xã" : "Chọn quận/huyện trước"}</option>
        {communes.map((item) => <option key={item.code} value={item.code}>{optionLabel(item)}</option>)}
      </select>
    </label>
    {error && <small>{error}</small>}
  </>;
}
