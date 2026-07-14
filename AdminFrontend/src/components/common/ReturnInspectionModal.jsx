import { ClipboardCheck, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import {
    costumeImage,
    costumeName,
    money
} from "../../utils/format.js";
import { ModalSelect, MoneyThousandsInput, PlainNumberInput } from "./AdminControls.jsx";

const idOf = (item) => item?.id || item?._id || "";

function calculateLateCharge(order) {
    const dueAt = new Date(order?.returnDate || 0);
    const returnedAt = new Date(order?.actualReturnDate || order?.returnedAt || Date.now());
    if (Number.isNaN(dueAt.getTime()) || Number.isNaN(returnedAt.getTime()) || returnedAt <= dueAt) {
        return { lateHours: 0, lateFee: 0 };
    }
    const lateHours = Math.ceil((returnedAt - dueAt) / 3600000);
    return { lateHours, lateFee: Number(order?.extraDayCharge?.finalAmount || 0) };
}

const costumeIdOf = (item) => {
    return (
        idOf(item?.costume) ||
        idOf(item?.costumeId) ||
        (typeof item?.costumeId === "string" ? item.costumeId : "") ||
        (typeof item?.costume === "string" ? item.costume : "")
    );
};
const createInitialItems = (order) =>
    (order?.items || []).map((item) => ({
        costumeId: costumeIdOf(item),
        condition: "good",
        damageFee: 0,
        missingAccessories: "",
        isDry: true, missingBags: 0, missingBoxes: 0,
        cleaningSeverity: "none", cleaningFee: 0, shopSupportAmount: 0,
        damageSeverity: "none", repairFee: 0, liquidationPrice: 0, evidenceUrls: "",
        note: ""
    }));
export function ReturnInspectionModal({
    open,
    order,
    loading = false,
    onClose,
    onSubmit
}) {
    const [lateHours, setLateHours] = useState(0);
    const [lateFee, setLateFee] = useState(0);
    const [note, setNote] = useState("");
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || !order) return;

        const existing = order.returnInspection;

        const calculatedLateCharge = calculateLateCharge(order);
        setLateHours(existing?.lateHours ?? calculatedLateCharge.lateHours);
        setLateFee(existing?.lateFee ?? calculatedLateCharge.lateFee);
        setNote(existing?.note || "");

        setItems(
            existing?.items?.length
                ? existing.items.map((item) => ({
                    costumeId:
                        idOf(item.costumeId) ||
                        idOf(item.costume) ||
                        (typeof item.costumeId === "string"
                            ? item.costumeId
                            : "") ||
                        (typeof item.costume === "string"
                            ? item.costume
                            : ""),
                    condition: item.condition || "good",
                    damageFee: Number(item.damageFee || 0),
                    missingAccessories: item.missingAccessories || "",
                    note: item.note || ""
                }))
                : createInitialItems(order)
        );

        setError("");
    }, [open, order]);

    const updateItem = (index, field, value) => {
        setItems((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                        ...item,
                        [field]: value
                    }
                    : item
            )
        );
    };

    const totalDamageFee = useMemo(
        () =>
            items.reduce(
                (sum, item) => sum + Number(item.damageFee || 0),
                0
            ),
        [items]
    );

    const totalPenaltyFee =
        Number(lateFee || 0) + Number(totalDamageFee || 0);

    const validate = () => {
        if (!items.length) {
            return "Đơn thuê không có trang phục để kiểm tra.";
        }
        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];

            if (!item.costumeId || typeof item.costumeId !== "string") {
                return `Không xác định được trang phục thứ ${index + 1}.`;
            }

            if (!item.condition) {
                return `Vui lòng chọn tình trạng cho trang phục thứ ${index + 1}.`;
            }

            if (Number(item.damageFee || 0) < 0) {
                return "Phí hư hỏng không được nhỏ hơn 0.";
            }

            if (
                ["damaged", "lost", "lost_accessory"].includes(item.condition) &&
                !item.note.trim()
            ) {
                return `Vui lòng nhập ghi chú cho trang phục thứ ${index + 1}.`;
            }
        }

        if (Number(lateHours || 0) < 0) {
            return "Số giờ trễ không được nhỏ hơn 0.";
        }

        if (Number(lateFee || 0) < 0) {
            return "Phí trả trễ không được nhỏ hơn 0.";
        }

        return "";
    };

    const submit = async (event) => {
        event.preventDefault();

        const validationError = validate();

        if (validationError) {
            setError(validationError);
            return;
        }

        setError("");

        const payload = {
            lateHours: Number(lateHours || 0),
            lateFee: Number(lateFee || 0),
            totalDamageFee,
            totalPenaltyFee,
            note: note.trim(),
            items: items.map((item) => ({
                costumeId: String(item.costumeId || ""),
                condition: item.condition,
                damageFee: Number(item.damageFee || 0),
                missingAccessories: String(
                    item.missingAccessories || ""
                ).trim(),
                isDry: item.isDry !== false,
                missingBags: Number(item.missingBags || 0),
                missingBoxes: Number(item.missingBoxes || 0),
                cleaningSeverity: item.cleaningSeverity || "none",
                cleaningFee: Number(item.cleaningFee || 0),
                shopSupportAmount: Number(item.shopSupportAmount || 0),
                damageSeverity: item.damageSeverity || "none",
                repairFee: Number(item.repairFee || 0),
                liquidationPrice: Number(item.liquidationPrice || 0),
                evidenceUrls: String(item.evidenceUrls || ""),
                note: String(item.note || "").trim()
            }))
        };

        await onSubmit(payload);
    };

    if (!open || !order) return null;

    return (
        <div className="admin-modal-backdrop">
            <div
                className="return-inspection-modal"
                role="dialog"
                aria-modal="true"
            >
                <div className="return-inspection-header">
                    <div>
                        <span className="return-inspection-heading-icon">
                            <ClipboardCheck size={20} />
                        </span>

                        <div>
                            <h2>Kiểm tra trả đồ</h2>
                            <p>
                                Đơn #{String(idOf(order)).slice(-6).toUpperCase()}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="admin-modal-close"
                        onClick={onClose}
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={submit}>
                    <div className="return-inspection-body">
                        <section className="inspection-order-summary">
                            <div>
                                <span>Khách hàng</span>
                                <strong>{order.customer?.name || "-"}</strong>
                            </div>

                            <div>
                                <span>Số điện thoại</span>
                                <strong>{order.customer?.phone || "-"}</strong>
                            </div>

                            <div>
                                <span>Ngày thuê</span>
                                <strong>{String(order.rentalDate || "").slice(0, 10)}</strong>
                            </div>

                            <div>
                                <span>Ngày trả dự kiến</span>
                                <strong>{String(order.returnDate || "").slice(0, 10)}</strong>
                            </div>
                        </section>

                        <section>
                            <h3>Trang phục được trả</h3>

                            <div className="inspection-item-list">
                                {(order.items || []).map((orderItem, index) => {
                                    const inspectionItem = items[index] || {};

                                    return (
                                        <div
                                            className="inspection-item-card"
                                            key={
                                                idOf(orderItem) ||
                                                idOf(orderItem.costume) ||
                                                index
                                            }
                                        >
                                            <div className="inspection-item-info">
                                                <img
                                                    src={costumeImage(orderItem)}
                                                    alt={costumeName(orderItem)}
                                                    onError={(event) => {
                                                        event.currentTarget.src = "/placeholder.png";
                                                    }}
                                                />

                                                <div>
                                                    <strong>{costumeName(orderItem)}</strong>
                                                    <small>
                                                        Số lượng: {orderItem.quantity || 1}
                                                    </small>
                                                </div>
                                            </div>

                                            <div className="inspection-item-fields">
                                                <ModalSelect label="Tình trạng" value={inspectionItem.condition || "good"} onChange={(value) => updateItem(index, "condition", value)} options={[["good", "Tốt"], ["dirty", "Bẩn, cần giặt"], ["damaged", "Hư hỏng"], ["lost_accessory", "Mất phụ kiện"], ["lost", "Thất lạc trang phục"]]} />

                                                <MoneyThousandsInput label="Phí hư hỏng" value={inspectionItem.damageFee || ""} onChange={(value) => updateItem(index, "damageFee", value)} />
                                                <label><input type="checkbox" checked={inspectionItem.isDry !== false} onChange={e => updateItem(index, "isDry", e.target.checked)}/> Đồ khô ráo</label>
                                                <PlainNumberInput label="Số túi bọc thiếu" value={inspectionItem.missingBags || 0} onChange={value => updateItem(index, "missingBags", value)} />
                                                <PlainNumberInput label="Số box thiếu (50.000đ/box)" value={inspectionItem.missingBoxes || 0} onChange={value => updateItem(index, "missingBoxes", value)} />
                                                <ModalSelect label="Mức độ vết bẩn" value={inspectionItem.cleaningSeverity || "none"} onChange={value => updateItem(index, "cleaningSeverity", value)} options={[["none", "Không"], ["light", "Dơ nhẹ - miễn phí"], ["heavy", "Dơ nặng"]]} />
                                                <MoneyThousandsInput label="Tổng phí giặt" value={inspectionItem.cleaningFee || ""} onChange={value => updateItem(index, "cleaningFee", value)} />
                                                <MoneyThousandsInput label="Shop hỗ trợ" value={inspectionItem.shopSupportAmount || ""} onChange={value => updateItem(index, "shopSupportAmount", value)} />
                                                <ModalSelect label="Mức độ hư hỏng" value={inspectionItem.damageSeverity || "none"} onChange={value => updateItem(index, "damageSeverity", value)} options={[["none", "Không"], ["minor", "Nhẹ, có thể sửa"], ["irreparable", "Không thể sửa"]]} />
                                                <MoneyThousandsInput label="Phí sửa chữa" value={inspectionItem.repairFee || ""} onChange={value => updateItem(index, "repairFee", value)} />
                                                <MoneyThousandsInput label="Giá thanh lý" value={inspectionItem.liquidationPrice || ""} onChange={value => updateItem(index, "liquidationPrice", value)} />
                                                <label className="inspection-full-field">Ảnh/video bằng chứng<textarea value={inspectionItem.evidenceUrls || ""} onChange={e => updateItem(index, "evidenceUrls", e.target.value)} placeholder="Mỗi URL một dòng"/></label>

                                                <label>
                                                    Phụ kiện bị mất
                                                    <input
                                                        value={
                                                            inspectionItem.missingAccessories || ""
                                                        }
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "missingAccessories",
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Không có"
                                                    />
                                                </label>

                                                <label className="inspection-full-field">
                                                    Ghi chú
                                                    <textarea
                                                        value={inspectionItem.note || ""}
                                                        onChange={(event) =>
                                                            updateItem(
                                                                index,
                                                                "note",
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Mô tả tình trạng trang phục"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="inspection-general-section">
                            <h3>Phí phát sinh</h3>

                            <div className="inspection-general-grid">
                                <PlainNumberInput
                                    label="Số giờ trễ"
                                    value={lateHours}
                                    min={0}
                                    onChange={setLateHours}
                                />

                                <MoneyThousandsInput
                                    label="Phí trả trễ"
                                    value={lateFee}
                                    onChange={setLateFee}
                                />

                                <label className="inspection-full-field">
                                    Ghi chú chung
                                    <textarea
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                        placeholder="Ghi chú chung về lần trả đồ"
                                    />
                                </label>
                            </div>

                            <div className="inspection-total-box">
                                <div>
                                    <span>Phí trả trễ</span>
                                    <strong>{money(Number(lateFee || 0))}</strong>
                                </div>

                                <div>
                                    <span>Phí hư hỏng</span>
                                    <strong>{money(totalDamageFee)}</strong>
                                </div>

                                <div className="inspection-grand-total">
                                    <span>Tổng phí phát sinh</span>
                                    <strong>{money(totalPenaltyFee)}</strong>
                                </div>
                            </div>
                        </section>

                        {error && <p className="inspection-error">{error}</p>}
                    </div>

                    <div className="return-inspection-footer">
                        <button
                            type="button"
                            className="admin-modal-cancel"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Hủy
                        </button>

                        <button
                            type="submit"
                            className="admin-modal-confirm primary"
                            disabled={loading}
                        >
                            {loading ? "Đang lưu..." : "Lưu biên bản"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
