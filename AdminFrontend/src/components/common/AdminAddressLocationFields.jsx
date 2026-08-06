import React, { useEffect, useState } from "react";
import { ModalCombobox } from "./AdminControls.jsx";
import { listCommunes, listDistricts, listProvinces } from "../../services/locationService.js";

const itemsFrom = (result) => result.data?.items || [];
const optionLabel = (item) => item.displayName || item.name;
const optionsFrom = (items) => items.map((item) => [String(item.code), optionLabel(item)]);

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

  const selectProvince = (value) => {
    const selected = provinces.find((item) => String(item.code) === String(value));
    onChange({ provinceCode: value, provinceName: selected ? optionLabel(selected) : "", districtCode: "", districtName: "", communeCode: "", communeName: "", wardName: "" });
  };

  const selectDistrict = (value) => {
    const selected = districts.find((item) => String(item.code) === String(value));
    onChange({ districtCode: value, districtName: selected ? optionLabel(selected) : "", communeCode: "", communeName: "", wardName: "" });
  };

  const selectCommune = (value) => {
    const selected = communes.find((item) => String(item.code) === String(value));
    onChange({ communeCode: value, communeName: selected ? optionLabel(selected) : "", wardName: selected ? optionLabel(selected) : "" });
  };

  return <>
    <ModalCombobox label="Tỉnh/thành phố" value={provinceCode || ""} onChange={selectProvince} placeholder="Chọn tỉnh/thành phố" searchPlaceholder="Tìm tỉnh/thành phố..." options={optionsFrom(provinces)} />
    <ModalCombobox label="Quận/huyện" value={districtCode || ""} onChange={selectDistrict} placeholder={provinceCode ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"} searchPlaceholder="Tìm quận/huyện..." options={optionsFrom(districts)} disabled={!provinceCode} />
    <ModalCombobox label="Phường/xã" value={communeCode || ""} onChange={selectCommune} placeholder={districtCode ? "Chọn phường/xã" : "Chọn quận/huyện trước"} searchPlaceholder="Tìm phường/xã..." options={optionsFrom(communes)} disabled={!districtCode} />
    {error && <small>{error}</small>}
  </>;
}
