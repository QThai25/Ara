export const ZONE_PRESETS = {
  near: { label: "Khu vực gần", minutes: 45, buffer: 15 },
  medium: { label: "Khu vực trung bình", minutes: 60, buffer: 15 },
  far: { label: "Khu vực xa", minutes: 90, buffer: 30 }
};

export const roundTransportMinutes = (base, buffer, interval) => {
  const raw = Math.max(0, Number(base) || 0) + Math.max(0, Number(buffer) || 0);
  const step = Math.max(1, Number(interval) || 1);
  return { raw, rounded: Math.ceil(raw / step) * step };
};

export function findRuleOverlap(rules = []) {
  for (let index = 0; index < rules.length; index += 1) {
    for (let next = index + 1; next < rules.length; next += 1) {
      const left = rules[index];
      const right = rules[next];
      if (left.dayType === right.dayType && left.startTime < right.endTime && left.endTime > right.startTime) {
        return `Khung giờ ${left.startTime}–${left.endTime} đang bị trùng với ${right.startTime}–${right.endTime}. Vui lòng điều chỉnh để mỗi thời điểm chỉ thuộc một khung giờ.`;
      }
    }
  }
  return "";
}

export function applyZonePreset(form, presetKey) {
  const preset = ZONE_PRESETS[presetKey];
  if (!preset) return form;
  return {
    ...form,
    fallbackOutboundMinutes: preset.minutes,
    fallbackInboundMinutes: preset.minutes,
    outboundSafetyBufferMinutes: preset.buffer,
    inboundSafetyBufferMinutes: preset.buffer,
    roundingMinutes: 15
  };
}

export function buildShippingZonePayload(form) {
  const { _id, quoteVersion, version, createdAt, updatedAt, createdBy, updatedBy, ...editable } = form;
  return {
    ...editable,
    provinceNames: String(form.provinceNames || "").split(",").map((item) => item.trim()).filter(Boolean),
    districtNames: [...new Set((form.districtNames || []).map((item) => String(item).trim()).filter(Boolean))],
    fallbackOutboundMinutes: Number(form.fallbackOutboundMinutes),
    fallbackInboundMinutes: Number(form.fallbackInboundMinutes),
    outboundSafetyBufferMinutes: Number(form.outboundSafetyBufferMinutes),
    inboundSafetyBufferMinutes: Number(form.inboundSafetyBufferMinutes),
    roundingMinutes: Number(form.roundingMinutes),
    deliveryFee: Number(form.deliveryFee),
    collectionFee: Number(form.collectionFee),
    outboundFee: Number(form.deliveryFee ?? form.outboundFee ?? 0),
    returnFee: Number(form.collectionFee ?? form.returnFee ?? 0),
    transportTimeRules: (form.transportTimeRules || []).map((rule, priority) => ({
      ...rule, priority,
      outboundMinutes: Number(rule.outboundMinutes),
      inboundMinutes: Number(rule.inboundMinutes),
      outboundSafetyBufferMinutesOverride: rule.outboundSafetyBufferMinutesOverride === "" ? null : Number(rule.outboundSafetyBufferMinutesOverride),
      inboundSafetyBufferMinutesOverride: rule.inboundSafetyBufferMinutesOverride === "" ? null : Number(rule.inboundSafetyBufferMinutesOverride)
    }))
  };
}
