import { GripVertical, ImagePlus, Star, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { uploadImages } from "../../services/uploadService.js";
import { resolveImageUrl } from "../../utils/format.js";

function normalizeAssets(value = []) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((item, index) => {
    if (typeof item === "string") return { url: item, publicId: "", alt: "", sortOrder: index };
    return { ...item, url: item?.url || item?.image || "", publicId: item?.publicId || item?.imagePublicId || "", alt: item?.alt || "", sortOrder: index };
  }).filter((item) => {
    const key = item.url || item.previewUrl || `${item.file?.name}-${item.file?.size}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function MultiImageUploader({
  label = "Hình ảnh",
  value = [],
  onChange,
  max = 10,
  primaryUrl = "",
  onPrimaryChange,
  notify,
  previewClassName = "",
  onUploadingChange,
  deferred = false
}) {
  const assets = normalizeAssets(value);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const draggedIndexRef = useRef(null);
  const previewUrlsRef = useRef([]);

  useEffect(() => {
    previewUrlsRef.current = assets.map((asset) => asset.previewUrl).filter((url) => url?.startsWith("blob:"));
  });
  useEffect(() => () => previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const commit = (next) => onChange?.(next.slice(0, max).map((item, index) => ({ ...item, sortOrder: index })));

  const selectFiles = async (files) => {
    const selected = Array.from(files || []);
    const accepted = selected.filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
    if (!accepted.length) {
      if (selected.length) notify?.("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.", "error");
      return;
    }
    const remaining = max - assets.length;
    if (remaining <= 0) return notify?.(`Chỉ được tải tối đa ${max} ảnh.`, "error");
    if (accepted.length > remaining) notify?.(`Chỉ thêm ${remaining} ảnh để không vượt quá giới hạn ${max}.`, "error");
    const filesToAdd = accepted.slice(0, remaining);

    if (deferred) {
      const pending = filesToAdd.map((file, index) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        url: "",
        publicId: "",
        alt: file.name.replace(/\.[^.]+$/, ""),
        sortOrder: assets.length + index
      }));
      const next = [...assets, ...pending];
      commit(next);
      if (!primaryUrl && next[0]) onPrimaryChange?.(next[0].url || next[0].previewUrl);
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const result = await uploadImages(filesToAdd);
      const uploaded = (result?.images || []).map((item, index) => ({ ...item, alt: item.alt || "", sortOrder: assets.length + index }));
      const next = [...assets, ...uploaded];
      commit(next);
      if (!primaryUrl && next[0]?.url) onPrimaryChange?.(next[0].url);
      notify?.("Tải ảnh thành công.");
    } catch (error) {
      notify?.(error?.response?.data?.message || error?.message || "Không thể tải hình ảnh.", "error");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  const remove = (index) => {
    const removed = assets[index];
    if (removed?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
    const next = assets.filter((_, itemIndex) => itemIndex !== index);
    commit(next);
    if ([removed?.url, removed?.previewUrl].includes(primaryUrl)) onPrimaryChange?.(next[0]?.url || next[0]?.previewUrl || "");
  };

  const reorder = (from, to) => {
    if (from == null || from === to || from < 0 || to < 0 || from >= assets.length || to >= assets.length) return;
    const next = [...assets];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  return <section className="multi-image-uploader">
    <header><div><strong>{label}</strong><small>Kéo thả ảnh để đổi thứ tự</small></div><b>{assets.length}/{max} ảnh</b></header>
    <label className={`multi-image-dropzone ${dragOver ? "is-dragover" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => { event.preventDefault(); setDragOver(false); selectFiles(event.dataTransfer.files); }}>
      <ImagePlus size={24}/><span>{uploading ? "Đang tải ảnh..." : "Kéo ảnh vào đây hoặc bấm để chọn"}</span>
      <small>JPG, PNG, WEBP · tối đa 5MB/ảnh</small>
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploading || assets.length >= max}
        onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }}/>
    </label>
    {assets.length > 0 && <div className={`multi-image-preview ${previewClassName}`}>
      {assets.map((asset, index) => {
        const identity = asset.url || asset.previewUrl;
        const isPrimary = identity === primaryUrl;
        return <article key={`${identity || asset.file?.name}-${index}`} draggable className={isPrimary ? "is-primary" : ""}
          onDragStart={() => { draggedIndexRef.current = index; }} onDragEnd={() => { draggedIndexRef.current = null; }}
          onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorder(draggedIndexRef.current, index); draggedIndexRef.current = null; }}>
          <img src={asset.previewUrl || resolveImageUrl(asset.url)} alt={asset.alt || `${label} ${index + 1}`} onError={(event) => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = "1"; event.currentTarget.src = "/placeholder.png"; } }}/>
          <span className="multi-image-order"><GripVertical size={14}/>{index + 1}</span>
          {onPrimaryChange && <button type="button" className="multi-image-primary" aria-label={isPrimary ? "Ảnh đại diện hiện tại" : "Chọn làm ảnh đại diện"} aria-pressed={isPrimary} onClick={() => onPrimaryChange(identity)}><Star size={15} fill={isPrimary ? "currentColor" : "none"}/></button>}
          <button type="button" className="multi-image-remove" aria-label={`Xóa ảnh ${index + 1}`} onClick={() => remove(index)}><Trash2 size={15}/></button>
        </article>;
      })}
    </div>}
  </section>;
}

export default MultiImageUploader;
