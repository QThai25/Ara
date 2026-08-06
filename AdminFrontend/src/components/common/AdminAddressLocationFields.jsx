import React, { useEffect, useState } from "react";
import { listCommunes, listDistricts, listProvinces } from "../../services/locationService.js";

const itemsFrom = (result) => result.data?.items || [];

export function AdminAddressLocationFields({ provinceCode, districtCode, communeCode, allowedProvinceCodes = [], onChange }) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listProvinces()
      .then((result) => {
        if (!active) return;
        const next = itemsFrom(result);
        setProvinces(allowedProvinceCodes.length ? next.filter((item) => allowedProvinceCodes.includes(String(item.code))) : next);
        setError("");
      })
      .catch(() => {
        if (active) setError("Không tải được danh sách tỉnh/thành phố.");
      });
    return () => { active = false; };
  }, [allowedProvinceCodes.join(",")]);

  useEffect(() => {
    let active = true;
    if (!provinceCode) {
      setDistricts([]);
      return () => { active = false; };
    }
    listDistricts(provinceCode)
      .then((result) => {
        if (!active) return;
        setDistricts(itemsFrom(result));
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setDistricts([]);
        setError("Không tải được danh sách quận/huyện.");
      });
    return () => { active = false; };
  }, [provinceCode]);

  useEffect(() => {
    let active = true;
    if (!provinceCode || !districtCode) {
      setCommunes([]);
      return () => { active = false; };
    }
    listCommunes(provinceCode, [districtCode])
      .then((result) => {
        if (!active) return;
        setCommunes(itemsFrom(result));
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setCommunes([]);
        setError("Không tải được danh sách phường/xã.");
      });
    return () => { active = false; };
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
