import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Calculator, Clock3, Info, MapPinned, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { completeRefund, createShippingZone, deleteShippingZone, listRefunds, listShippingZones, startRefund, updateShippingZone } from "../services/fulfillmentRefundService.js";
import { applyZonePreset, buildShippingZonePayload, findRuleOverlap, roundTransportMinutes, ZONE_PRESETS } from "../utils/shippingZoneForm.js";
import { MoneyThousandsInput } from "../components/common/AdminControls.jsx";
import { AddressLocationSelector } from "../components/common/AddressLocationSelector.jsx";

const money = (value) => `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))} đ`;
const emptyRule = () => ({ dayType: "weekday", startTime: "08:00", endTime: "10:00", outboundMinutes: 60, inboundMinutes: 60, outboundSafetyBufferMinutesOverride: "", inboundSafetyBufferMinutesOverride: "", active: true });
const emptyZone = () => ({ name: "", provinceCode: "", provinceNameSnapshot: "", coverageType: "entire_province", districtCodes: [], districtNameSnapshots: [], communeCodes: [], communeNameSnapshots: [], provinceNames: "", districtNames: [], deliveryFee: 0, collectionFee: 0, fallbackOutboundMinutes: 60, fallbackInboundMinutes: 60, outboundSafetyBufferMinutes: 15, inboundSafetyBufferMinutes: 15, roundingMinutes: 15, supported: true, active: true, transportTimeRules: [] });
const dayLabels = { weekday: "Ngày thường", weekend: "Cuối tuần", holiday: "Ngày lễ", all: "Tất cả các ngày" };

function Field({ id, label, helper, children, className = "" }) {
  return <label htmlFor={id} className={className}><span>{label}</span>{children}{helper&&<small id={`${id}-help`}>{helper}</small>}</label>;
}

function BufferControl({ id, value, onChange, label, helper }) {
  const preset = [0, 15, 30].includes(Number(value)) ? String(value) : "custom";
  return <div className="admin-zone-field-group">
    <strong>{label}</strong><small id={`${id}-help`}>{helper}</small>
    <div className="admin-zone-preset-row" role="group" aria-describedby={`${id}-help`}>
      {[[0,"Không thêm"],[15,"15 phút"],[30,"30 phút"],["custom","Tùy chỉnh"]].map(([amount,text])=><button type="button" key={amount} className={preset===String(amount)?"selected":""} onClick={()=>amount==="custom"?onChange([0,15,30].includes(Number(value))?20:value):onChange(amount)}>{text}</button>)}
    </div>
    {preset==="custom"&&<div className="admin-zone-input-suffix"><input id={id} type="number" min="0" step="5" value={value} onChange={(e)=>onChange(Math.max(0,Number(e.target.value)))} aria-describedby={`${id}-help`}/><span>phút</span></div>}
  </div>;
}

function DurationPreview({ title, base, buffer, rounding }) {
  const result = roundTransportMinutes(base, buffer, rounding);
  return <article className="admin-zone-preview"><Calculator size={19}/><div><small>{title}</small><p><b>{Number(base)||0} phút</b> di chuyển <span>+</span> <b>{Number(buffer)||0} phút</b> dự phòng</p><strong>= {result.raw} phút</strong>{result.rounded!==result.raw&&<><i>→ Làm tròn thành {result.rounded} phút</i>{result.rounded-result.raw>=10&&<em>Khoảng làm tròn đang tạo chênh lệch {result.rounded-result.raw} phút. Bạn có thể chọn mức dự phòng 15 hoặc 30 phút để dễ quản lý hơn.</em>}</>}</div></article>;
}

function DistrictChips({ values, onChange }) {
  const [draft,setDraft]=useState("");
  const add=()=>{const value=draft.trim();if(value&&!values.some((item)=>item.toLowerCase()===value.toLowerCase()))onChange([...values,value]);setDraft("")};
  return <div className="admin-zone-chip-control">
    <div>{values.map((value)=><span key={value}>{value}<button type="button" onClick={()=>onChange(values.filter((item)=>item!==value))} aria-label={`Bỏ ${value}`}><X size={13}/></button></span>)}</div>
    <input value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();add()}}} placeholder="Nhập tên quận/huyện rồi nhấn Enter"/>
    <button type="button" onClick={add}>Thêm</button>
  </div>;
}

function PresetPicker({ onPick, onClose }) {
  return <div className="admin-zone-preset-dialog" role="dialog" aria-modal="true" aria-labelledby="preset-title"><header><div><h3 id="preset-title">Dùng cấu hình gợi ý</h3><p>Chọn mức gần đúng, sau đó bạn vẫn có thể chỉnh trước khi lưu.</p></div><button type="button" onClick={onClose} aria-label="Đóng"><X/></button></header><div>{Object.entries(ZONE_PRESETS).map(([key,preset])=><button type="button" key={key} onClick={()=>onPick(key)}><strong>{preset.label}</strong><span>Thời gian thường: {preset.minutes} phút</span><span>Dự phòng: {preset.buffer} phút</span><b>Tổng: {preset.minutes+preset.buffer} phút</b></button>)}</div></div>;
}

function ZoneModal({ zone, zones, onClose, onSaved, notify }) {
  const [form,setForm]=useState(()=>zone?{...zone,provinceNames:(zone.provinceNames||[]).join(", "),coverageType:zone.coverageType||"entire_province",districtCodes:[...(zone.districtCodes||[])],communeCodes:[...(zone.communeCodes||[])],districtNames:[...(zone.districtNames||[])],deliveryFee:zone.deliveryFee??zone.outboundFee??0,collectionFee:zone.collectionFee??zone.returnFee??0,transportTimeRules:(zone.transportTimeRules||[]).map((rule)=>({...rule}))}:emptyZone());
  const [saving,setSaving]=useState(false),[presetOpen,setPresetOpen]=useState(false),[error,setError]=useState("");
  const firstField=useRef(null);
  const set=(key,value)=>setForm((current)=>({...current,[key]:value}));
  const setRule=(index,key,value)=>setForm((current)=>({...current,transportTimeRules:current.transportTimeRules.map((rule,position)=>position===index?{...rule,[key]:value}:rule)}));
  const overlapMessage=useMemo(()=>findRuleOverlap(form.transportTimeRules),[form.transportTimeRules]);
  const outbound=roundTransportMinutes(form.fallbackOutboundMinutes,form.outboundSafetyBufferMinutes,form.roundingMinutes);
  const inbound=roundTransportMinutes(form.fallbackInboundMinutes,form.inboundSafetyBufferMinutes,form.roundingMinutes);
  const counts=form.transportTimeRules.reduce((result,rule)=>({...result,[rule.dayType]:(result[rule.dayType]||0)+1}),{});
  const validate=()=>{
    if(!form.name.trim())return "Vui lòng nhập tên khu vực.";
    if(!form.provinceCode)return "Vui lòng chọn tỉnh/thành phố trong danh sách.";
    if(form.coverageType!=="entire_province"&&!form.districtCodes.length)return "Vui lòng chọn ít nhất một quận/huyện áp dụng.";
    if(form.coverageType==="selected_communes"&&!form.communeCodes.length)return "Vui lòng chọn ít nhất một phường/xã được hỗ trợ.";
    if(Number(form.fallbackOutboundMinutes)<=0)return "Vui lòng nhập thời gian giao đến khách lớn hơn 0 phút.";
    if(Number(form.fallbackInboundMinutes)<=0)return "Vui lòng nhập thời gian mang đồ về cửa hàng lớn hơn 0 phút.";
    if(overlapMessage)return overlapMessage;
    return "";
  };
  const submit=async(event)=>{event.preventDefault();const message=validate();if(message){setError(message);firstField.current?.focus();return}setSaving(true);setError("");try{const payload=buildShippingZonePayload(form);zone?await updateShippingZone(zone._id,payload):await createShippingZone(payload);notify?.(zone?"Đã cập nhật khu vực.":"Đã thêm khu vực.","success");await onSaved();onClose()}catch(apiError){setError(apiError.message);notify?.(apiError.message,"error")}finally{setSaving(false)}};
  return <div className="admin-zone-overlay"><form className="admin-zone-editor" onSubmit={submit} noValidate>
    <header><div><span>THIẾT LẬP GIAO NHẬN</span><h2>{zone?"Chỉnh sửa khu vực":"Thêm khu vực giao nhận"}</h2></div><div className="admin-zone-header-actions"><button type="button" onClick={()=>setPresetOpen(true)}><Sparkles size={16}/>Dùng cấu hình gợi ý</button><button type="button" onClick={onClose} aria-label="Đóng"><X/></button></div></header>
    {zone?.needsTransportConfiguration&&<div className="admin-zone-warning"><AlertTriangle/><div><strong>Cần bổ sung thời gian vận chuyển</strong><p>Khu vực đang dùng giá trị tạm thời. Vui lòng kiểm tra và lưu lại.</p></div></div>}
    {error&&<div className="admin-zone-form-error" role="alert" aria-live="assertive"><AlertTriangle/>{error}</div>}
    <section><h3>Thông tin khu vực</h3><div className="admin-zone-fields">
      <Field id="zone-name" label="Tên khu vực"><input ref={firstField} id="zone-name" value={form.name} onChange={(e)=>set("name",e.target.value)} placeholder="Ví dụ: Khu vực trung tâm"/></Field>
      <div className="wide"><AddressLocationSelector provinceCode={form.provinceCode} districtCodes={form.districtCodes} communeCodes={form.communeCodes} coverageType={form.coverageType} onProvinceChange={(item)=>setForm((current)=>({...current,provinceCode:item.code,provinceNameSnapshot:item.name,provinceNames:item.name,districtCodes:[],districtNames:[],districtNameSnapshots:[],communeCodes:[],communeNameSnapshots:[]}))} onDistrictCodesChange={(value)=>setForm((current)=>({...current,districtCodes:value,coverageType:value.length&&current.coverageType==="entire_province"?"selected_districts":current.coverageType}))} onCommuneCodesChange={(value)=>setForm((current)=>({...current,communeCodes:value,coverageType:value.length?"selected_communes":current.coverageType}))} onCoverageTypeChange={(value)=>set("coverageType",value)}/></div>
      <label className="admin-zone-toggle"><input type="checkbox" checked={form.supported} onChange={(e)=>set("supported",e.target.checked)}/><span><b>Cho phép khách chọn khu vực này</b></span></label>
      <label className="admin-zone-toggle"><input type="checkbox" checked={form.active} onChange={(e)=>set("active",e.target.checked)}/><span><b>Áp dụng cấu hình này</b></span></label>
    </div></section>
    <section><h3>Phí và thời gian thông thường</h3><p className="admin-zone-help">Thời gian dự phòng sẽ được cộng vào thời gian di chuyển.</p>
      <div className="admin-zone-fields">
        <div className="admin-zone-group-title"><span>01</span><div><strong>Chi phí giao nhận</strong><small>Nhập phí cho từng chiều.</small></div></div>
        <div className="admin-zone-boxed-field"><MoneyThousandsInput label="Phí giao đến khách" value={form.deliveryFee} onChange={(value)=>set("deliveryFee",value)}/>{form.deliveryFee !== ""&&Number(form.deliveryFee)===0&&<em>Miễn phí chiều giao</em>}</div>
        <div className="admin-zone-boxed-field"><MoneyThousandsInput label="Phí nhận lại" value={form.collectionFee} onChange={(value)=>set("collectionFee",value)}/>{form.collectionFee !== ""&&Number(form.collectionFee)===0&&<em>Miễn phí chiều nhận lại</em>}</div>
        <div className="admin-zone-total"><small>Tổng phí nếu giao và nhận tận nơi</small><strong>{money(Number(form.deliveryFee)+Number(form.collectionFee))}</strong><span>Phí giao đến khách + phí nhận lại</span></div>
        <div className="admin-zone-group-title"><span>02</span><div><strong>Thời gian giao nhận</strong><small>Thời gian di chuyển, dự phòng và cách làm tròn.</small></div></div>
        <Field id="outbound-time" label="Cửa hàng → khách" className="admin-zone-boxed-field"><div className="admin-zone-input-suffix"><input id="outbound-time" type="number" min="1" placeholder="45" value={form.fallbackOutboundMinutes} onChange={(e)=>set("fallbackOutboundMinutes",e.target.value)}/><span>phút</span></div></Field>
        <Field id="inbound-time" label="Khách → cửa hàng" className="admin-zone-boxed-field"><div className="admin-zone-input-suffix"><input id="inbound-time" type="number" min="1" placeholder="45" value={form.fallbackInboundMinutes} onChange={(e)=>set("fallbackInboundMinutes",e.target.value)}/><span>phút</span></div></Field>
        <BufferControl id="outbound-reserve" label="Thời gian dự phòng khi giao" helper="Cộng thêm để xử lý kẹt xe, tìm địa chỉ, đỗ xe và bàn giao cho khách." value={form.outboundSafetyBufferMinutes} onChange={(value)=>set("outboundSafetyBufferMinutes",value)}/>
        <BufferControl id="inbound-reserve" label="Thời gian dự phòng khi nhận lại" helper="Cộng thêm để liên hệ, chờ khách chuẩn bị đồ, kiểm tra sơ bộ và mang về." value={form.inboundSafetyBufferMinutes} onChange={(value)=>set("inboundSafetyBufferMinutes",value)}/>
        <Field id="rounding-time" label="Làm tròn theo"><select id="rounding-time" value={form.roundingMinutes} onChange={(e)=>set("roundingMinutes",Number(e.target.value))}>{[5,10,15,30].map((value)=><option key={value} value={value}>{value} phút{value===15?" – Khuyến nghị":""}</option>)}</select></Field>
      </div>
      <div className="admin-zone-preview-grid"><DurationPreview title="Thời gian hệ thống dành cho chiều giao" base={form.fallbackOutboundMinutes} buffer={form.outboundSafetyBufferMinutes} rounding={form.roundingMinutes}/><DurationPreview title="Thời gian hệ thống dành cho chiều nhận lại" base={form.fallbackInboundMinutes} buffer={form.inboundSafetyBufferMinutes} rounding={form.roundingMinutes}/></div>
      <div className="admin-zone-example"><Info/><p>Khách nhận lúc 10:00 → đồ rời cửa hàng lúc <b>{new Date(2000,0,1,10,0-outbound.rounded).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",hour12:false})}</b>.</p></div>
    </section>
    <section><div className="admin-zone-rule-head"><div><h3>Khung giờ riêng</h3><p>Dùng cho giờ cao điểm, cuối tuần hoặc ngày lễ.</p></div><button type="button" onClick={()=>set("transportTimeRules",[...form.transportTimeRules,emptyRule()])}><Plus size={15}/>Thêm khung giờ</button></div>
      {overlapMessage&&<p className="admin-zone-rule-error" aria-live="polite">{overlapMessage}</p>}
      <div className="admin-zone-rules">{form.transportTimeRules.map((rule,index)=>{const ruleOut=roundTransportMinutes(rule.outboundMinutes,rule.outboundSafetyBufferMinutesOverride??form.outboundSafetyBufferMinutes,form.roundingMinutes);const ruleIn=roundTransportMinutes(rule.inboundMinutes,rule.inboundSafetyBufferMinutesOverride??form.inboundSafetyBufferMinutes,form.roundingMinutes);return <article className="admin-zone-rule" key={rule._id||index}>
        <Field id={`day-${index}`} label="Loại ngày"><select id={`day-${index}`} value={rule.dayType} onChange={(e)=>setRule(index,"dayType",e.target.value)}>{Object.entries(dayLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
        <Field id={`from-${index}`} label="Từ"><input id={`from-${index}`} type="time" value={rule.startTime} onChange={(e)=>setRule(index,"startTime",e.target.value)}/></Field>
        <Field id={`to-${index}`} label="Đến"><input id={`to-${index}`} type="time" value={rule.endTime} onChange={(e)=>setRule(index,"endTime",e.target.value)}/></Field>
        <Field id={`rule-out-${index}`} label="Đến khách"><div className="admin-zone-input-suffix"><input id={`rule-out-${index}`} type="number" min="1" value={rule.outboundMinutes} onChange={(e)=>setRule(index,"outboundMinutes",e.target.value)}/><span>phút</span></div></Field>
        <Field id={`rule-in-${index}`} label="Về cửa hàng"><div className="admin-zone-input-suffix"><input id={`rule-in-${index}`} type="number" min="1" value={rule.inboundMinutes} onChange={(e)=>setRule(index,"inboundMinutes",e.target.value)}/><span>phút</span></div></Field>
        <button type="button" className="danger" aria-label={`Xóa khung giờ ${rule.startTime}–${rule.endTime} ${dayLabels[rule.dayType]}`} onClick={()=>set("transportTimeRules",form.transportTimeRules.filter((_,position)=>position!==index))}><Trash2 size={16}/></button>
        <p className="admin-zone-rule-preview">Thời gian sau dự phòng: <b>Giao đến khách {ruleOut.rounded} phút</b><span>•</span><b>Nhận về cửa hàng {ruleIn.rounded} phút</b></p>
      </article>})}</div>
    </section>
    <section className="admin-zone-summary"><h3>Tóm tắt</h3><div><p><span>Phạm vi</span><b>{form.districtNames.length} quận/huyện</b></p><p><span>Phí hai chiều</span><b>{money(Number(form.deliveryFee)+Number(form.collectionFee))}</b></p><p><span>Chiều giao</span><b>{outbound.rounded} phút</b></p><p><span>Chiều nhận</span><b>{inbound.rounded} phút</b></p><p><span>Khung giờ riêng</span><b>{form.transportTimeRules.length}</b></p></div></section>
    <footer><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={saving||Boolean(overlapMessage)}>{saving?"Đang lưu...":"Lưu cấu hình"}</button></footer>
    {presetOpen&&<PresetPicker onClose={()=>setPresetOpen(false)} onPick={(key)=>{setForm((current)=>applyZonePreset(current,key));setPresetOpen(false)}}/>}
  </form></div>;
}

export function AdminFulfillmentRefundPage({ notify }) {
  const [tab,setTab]=useState("zones"),[zones,setZones]=useState([]),[refunds,setRefunds]=useState([]),[editing,setEditing]=useState(null),[selected,setSelected]=useState(null),[reference,setReference]=useState("");
  const load=async()=>{try{setZones((await listShippingZones()).data||[]);setRefunds((await listRefunds()).data||[])}catch(error){notify?.(error.message,"error")}};
  useEffect(()=>{load()},[]);
  const run=async(action,message)=>{try{await action();notify?.(message,"success");setSelected(null);await load()}catch(error){notify?.(error.message,"error")}};
  return <main className="admin-fulfillment"><header><div><span>ARA OPERATIONS</span><h1>Vận chuyển & hoàn cọc</h1><p>Quản lý khu vực, thời gian giao nhận và giao dịch hoàn cọc thực tế.</p></div><nav><button className={tab==="zones"?"active":""} onClick={()=>setTab("zones")}><MapPinned size={16}/>Khu vực giao nhận</button><button className={tab==="refunds"?"active":""} onClick={()=>setTab("refunds")}><RotateCcw size={16}/>Hoàn cọc</button></nav></header>
    {tab==="zones"?<section><div className="admin-fr-title"><div><h2>Khu vực và thời gian vận chuyển</h2><p>Cấu hình rõ ràng theo tỉnh và quận/huyện, không sử dụng bản đồ trả phí.</p></div><button onClick={()=>setEditing({isNew:true})}><Plus size={15}/>Thêm khu vực</button></div><div className="admin-fr-grid">{zones.map(zone=><article key={zone._id} className={zone.needsTransportConfiguration?"needs-config":""}><div className="admin-zone-card-head"><strong>{zone.name}</strong>{zone.needsTransportConfiguration&&<em>Cần cấu hình</em>}</div><p>{(zone.provinceNames||[]).join(", ")||"Chưa chọn tỉnh/thành"}</p><span>Phí giao {money(zone.deliveryFee??zone.outboundFee)} · nhận lại {money(zone.collectionFee??zone.returnFee)}</span><div className="admin-zone-duration"><Clock3 size={15}/><b>Giao {zone.fallbackOutboundMinutes||zone.outboundMinutes}′</b><b>Nhận {zone.fallbackInboundMinutes||zone.inboundMinutes}′</b><small>Có thời gian dự phòng · làm tròn {zone.roundingMinutes||15}′</small></div><footer><button onClick={()=>setEditing(zone)}><Pencil size={14}/>Chỉnh sửa</button><button className="danger" onClick={()=>run(()=>deleteShippingZone(zone._id),"Đã xóa khu vực.")}><Trash2 size={14}/>Xóa</button></footer></article>)}</div></section>
      :<section><div className="admin-fr-title"><h2>Giao dịch hoàn cọc</h2></div><div className="admin-refund-list">{refunds.map(refund=><button key={refund._id} onClick={()=>{setSelected(refund);setReference("")}}><span><strong>{refund.refundCode}</strong><small>Đơn {refund.orderId?.orderCode||"—"} · {refund.customerId?.name||"Khách hàng"}</small></span><b>{money(refund.amount)}</b><i>{refund.status}</i></button>)}</div></section>}
    {editing&&<ZoneModal zone={editing.isNew?null:editing} zones={zones} onClose={()=>setEditing(null)} onSaved={load} notify={notify}/>}
    {selected&&<div className="admin-fr-modal"><h2>{selected.refundCode}</h2><p>Tiền hoàn: <strong>{money(selected.amount)}</strong></p><label>Mã giao dịch ngân hàng<input value={reference} onChange={(event)=>setReference(event.target.value)}/></label><footer><button onClick={()=>setSelected(null)}>Đóng</button>{selected.status==="pending"&&<button onClick={()=>run(()=>startRefund(selected._id),"Đã bắt đầu xử lý.")}>Bắt đầu xử lý</button>}{selected.status==="processing"&&<button onClick={()=>run(()=>completeRefund(selected._id,{transactionReference:reference,transferredAt:new Date().toISOString()}),"Đã hoàn cọc.")}>Xác nhận đã chuyển</button>}</footer></div>}
  </main>;
}
