import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote,
  CalendarClock,
  Check,
  Landmark,
  MapPin,
  Mail,
  Phone,
  ReceiptText,
  TicketPercent,
  Trash2,
  UserRound
} from "lucide-react";

import { StateMessage } from "../../components/common/StateMessage.jsx";
import { AddressLocationFields } from "../../components/customer/AddressLocationFields.jsx";
import { paths, views } from "../../routes/views.js";
import { checkCostumeAvailability } from "../../services/costumeService.js";
import {
  clearRentalCart,
  getRentalCart,
  removeFromRentalCart
} from "../../services/rentalCartService.js";
import {
  createRentalOrder,
  quoteRentalOrder
} from "../../services/rentalOrderService.js";
import { applyVoucher } from "../../services/voucherService.js";
import { listAddresses } from "../../services/accountService.js";
import { saveGuestOrderSession } from "../../utils/guestOrderSession.js";
import { fallbackImages } from "../../utils/catalogData.js";
import {
  formatDate,
  formatDateTime,
  money,
  rentalPriceBreakdown,
  resolveImageUrl
} from "../../utils/format.js";
import { newIdempotencyKey } from "../../utils/idempotency.js";

const RENTAL_POLICY_VERSION = "ARA_RENTAL_POLICY_2026_01";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function assistedCheckoutPrefill(){try{return JSON.parse(localStorage.getItem("ara_assisted_checkout")||"{}")}catch{return{}}}
function scheduledFulfillmentPrefill(){try{return JSON.parse(sessionStorage.getItem("ara_schedule_fulfillment")||"{}")}catch{return{}}}
function savedCheckoutVoucher(){try{return sessionStorage.getItem("ara_checkout_voucher")||""}catch{return""}}

function SavedAddressPicker({ addresses, value, onChange }) {
  if (!addresses.length) return null;
  return (
    <label className="wide ara-saved-address-picker">
      <span>Chọn từ sổ địa chỉ</span>
      <select value={value} onChange={onChange}>
        {addresses.map((address) => (
          <option key={address._id} value={address._id}>
            {address.isDefault ? "Mặc định · " : ""}{address.label} — {address.addressLine}, {address.wardName}, {address.districtName}
          </option>
        ))}
        <option value="">Nhập một địa chỉ khác</option>
      </select>
    </label>
  );
}

const CHECKOUT_OPTION_STYLES = `
/*
 * Checkout payment / invoice overrides.
 * Các selector đều bắt đầu bằng .cart-summary để thắng CSS cũ
 * mà không ảnh hưởng khu vực khác.
 */
.cart-page .cart-layout {
  grid-template-columns: minmax(0, 1fr) !important;
  gap: 28px !important;
}

.cart-page .cart-summary {
  position: static !important;
  top: auto !important;
  width: 100% !important;
  max-width: none !important;
  padding: clamp(24px, 4vw, 48px) !important;
}

.cart-page .cart-summary > .cart-summary-header,
.cart-page .cart-summary > .cart-progressive-fields,
.cart-page .cart-summary > .cart-checkout-summary,
.cart-page .cart-summary > .cart-policy-option,
.cart-page .cart-summary > .cart-policy-link,
.cart-page .cart-summary > .cart-checkout-submit {
  width: min(100%, 920px) !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.cart-page .cart-summary > .cart-summary-header {
  text-align: center;
}

@media (min-width: 760px) {
  .cart-page .cart-summary .ara-payment-options {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .cart-page .cart-summary .cart-checkout-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    column-gap: 32px !important;
  }

  .cart-page .cart-summary .cart-checkout-total {
    grid-column: 1 / -1;
  }
}

.cart-summary {
  container-type: inline-size;
  min-width: 0 !important;
  overflow: visible !important;
}

.cart-summary .cart-progressive-fields,
.cart-summary .cart-progressive-step,
.cart-summary .cart-invoice-section {
  width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

.cart-summary .cart-progressive-fields {
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
}

.cart-summary .cart-progressive-step.is-visible {
  position: relative !important;
  inset: auto !important;
  display: block !important;
  height: auto !important;
  max-height: 2000px !important;
  margin: 0 !important;
  overflow: visible !important;
  opacity: 1 !important;
  transform: none !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

.cart-summary .cart-invoice-section {
  position: relative !important;
  display: block !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}

.cart-summary .ara-payment-fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.cart-summary .ara-schedule-warning {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  margin: 0 0 18px;
  padding: 14px 16px;
  border: 1px solid #dc9c78;
  border-radius: 16px;
  background: #fff2ea;
  color: #7e351f;
  scroll-margin-top: 110px;
}

.cart-summary .ara-schedule-warning-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 13px;
  background: #f5ddce;
  color: #a85335;
}

.cart-summary .ara-schedule-warning-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.cart-summary .ara-schedule-warning-copy strong {
  font-size: 14px;
  line-height: 1.4;
}

.cart-summary .ara-schedule-warning-copy span {
  color: #8a5744;
  font-size: 12px;
  line-height: 1.5;
}

.cart-summary .ara-schedule-warning button {
  justify-self: start;
  margin-top: 6px;
  padding: 7px 12px;
  border: 1px solid #b96f4d;
  border-radius: 999px;
  background: #fffaf5;
  color: #71341f;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.cart-summary .ara-schedule-warning button:hover {
  background: #71341f;
  color: #fff;
}

.cart-summary .ara-checkout-fulfillment-review > .ara-fulfillment-group-title,
.cart-summary .ara-checkout-fulfillment-review > .ara-fulfillment-options,
.cart-summary .ara-checkout-fulfillment-review > .ara-shipping-address {
  display: none !important;
}

.cart-summary .ara-fulfillment-review-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 4px;
}

.cart-summary .ara-fulfillment-review-card > div {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
  border: 1px solid #e1ccb2;
  border-radius: 15px;
  background: #fffaf4;
}

.cart-summary .ara-fulfillment-review-card span {
  color: #927361;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.cart-summary .ara-fulfillment-review-card strong {
  color: #3e281e;
  font-size: 14px;
}

.cart-summary .ara-fulfillment-review-card small {
  color: #806b5e;
  line-height: 1.45;
}

.cart-summary .ara-fulfillment-review-card .is-wide {
  grid-column: 1 / -1;
}

@media (max-width: 600px) {
  .cart-summary .ara-fulfillment-review-card {
    grid-template-columns: 1fr;
  }
  .cart-summary .ara-fulfillment-review-card .is-wide {
    grid-column: auto;
  }
}

.cart-summary .ara-payment-legend {
  display: block;
  width: 100%;
  margin: 0 0 10px;
  padding: 0;
  color: #5f3829;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.cart-summary .ara-payment-options {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 10px !important;
  width: 100% !important;
  min-width: 0 !important;
}

.cart-summary .ara-payment-card {
  position: relative !important;
  inset: auto !important;
  display: grid !important;
  grid-template-columns: 44px minmax(0, 1fr) 20px !important;
  align-items: center !important;
  gap: 12px !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 78px !important;
  margin: 0 !important;
  padding: 12px 14px !important;
  overflow: hidden !important;
  border: 1px solid #e5d5c6 !important;
  border-radius: 18px !important;
  background: rgba(255, 253, 250, 0.96) !important;
  box-sizing: border-box !important;
  cursor: pointer;
  transform: none;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.cart-summary .ara-payment-card:hover {
  border-color: #c89f72 !important;
  background: #fffaf3 !important;
  transform: translateY(-1px);
}

.cart-summary .ara-payment-card:focus-within {
  border-color: #bd8a58 !important;
  box-shadow: 0 0 0 3px rgba(189, 138, 88, 0.14) !important;
}

.cart-summary .ara-payment-card.is-selected {
  border-color: #b87645 !important;
  background:
    linear-gradient(
      145deg,
      rgba(255, 253, 249, 0.99),
      rgba(250, 239, 225, 0.98)
    ) !important;
  box-shadow:
    0 0 0 3px rgba(200, 169, 106, 0.1),
    0 8px 20px rgba(92, 54, 37, 0.07) !important;
}

.cart-summary .ara-visually-hidden-input {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  margin: -1px !important;
  padding: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
  clip: rect(0 0 0 0) !important;
  clip-path: inset(50%) !important;
  white-space: nowrap !important;
}

.cart-summary .ara-payment-icon,
.cart-summary .ara-option-icon {
  display: grid !important;
  place-items: center !important;
  box-sizing: border-box !important;
  background: #f7eadb !important;
  color: #aa714d !important;
}

.cart-summary .ara-payment-icon {
  width: 44px !important;
  height: 44px !important;
  border-radius: 14px !important;
}

.cart-summary .ara-payment-card.is-selected .ara-payment-icon {
  background: #f1dfc9 !important;
  color: #8f512f !important;
}

.cart-summary .ara-payment-copy,
.cart-summary .ara-option-copy {
  display: flex !important;
  min-width: 0 !important;
  flex-direction: column !important;
  line-height: normal !important;
  text-align: left !important;
}

.cart-summary .ara-payment-copy {
  gap: 3px !important;
}

.cart-summary .ara-payment-copy strong,
.cart-summary .ara-payment-copy small,
.cart-summary .ara-option-copy strong,
.cart-summary .ara-option-copy small {
  min-width: 0 !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: left !important;
  white-space: normal !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  hyphens: none !important;
}

.cart-summary .ara-payment-copy strong {
  color: #341c13 !important;
  font-family: inherit !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  line-height: 1.28 !important;
}

.cart-summary .ara-payment-copy small {
  color: #886b5c !important;
  font-size: 12px !important;
  font-weight: 400 !important;
  line-height: 1.35 !important;
}

.cart-summary .ara-payment-radio {
  position: relative !important;
  display: block !important;
  width: 18px !important;
  height: 18px !important;
  flex: 0 0 18px !important;
  border: 1.5px solid #c7aa95 !important;
  border-radius: 50% !important;
  background: #fff !important;
  box-sizing: border-box !important;
}

.cart-summary .ara-payment-card.is-selected .ara-payment-radio {
  border-color: #a66039 !important;
}

.cart-summary .ara-payment-card.is-selected .ara-payment-radio::after {
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: #a66039;
  content: "";
}

.cart-summary .ara-invoice-option,
.cart-summary .ara-policy-option {
  position: relative !important;
  inset: auto !important;
  display: grid !important;
  grid-template-columns: 40px minmax(0, 1fr) 22px !important;
  align-items: center !important;
  gap: 11px !important;
  width: 100% !important;
  min-width: 0 !important;
  height: auto !important;
  min-height: 72px !important;
  max-height: none !important;
  padding: 12px 13px !important;
  overflow: visible !important;
  border: 1px solid #e5d8cc !important;
  border-radius: 17px !important;
  background: rgba(255, 253, 250, 0.96) !important;
  box-sizing: border-box !important;
  cursor: pointer;
  transform: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.cart-summary .ara-invoice-option {
  margin: 12px 0 0 !important;
}

.cart-summary .ara-policy-option {
  margin: 14px 0 0 !important;
}

.cart-summary .ara-invoice-option:hover,
.cart-summary .ara-policy-option:hover {
  border-color: #c89f72 !important;
  background: #fffaf3 !important;
}

.cart-summary .ara-invoice-option:focus-within,
.cart-summary .ara-policy-option:focus-within {
  border-color: #bd8a58 !important;
  box-shadow: 0 0 0 3px rgba(189, 138, 88, 0.13) !important;
}

.cart-summary .ara-invoice-option.is-selected,
.cart-summary .ara-policy-option.is-selected {
  border-color: #c09666 !important;
  background: #fff8ee !important;
}

.cart-summary .ara-option-icon {
  width: 40px !important;
  height: 40px !important;
  border-radius: 13px !important;
}

.cart-summary .ara-option-copy {
  gap: 2px !important;
  color: #5b382a !important;
}

.cart-summary .ara-option-copy strong {
  color: #4d2b1f !important;
  font-size: 14px !important;
  font-weight: 650 !important;
  line-height: 1.38 !important;
}

.cart-summary .ara-option-copy small {
  color: #8b7062 !important;
  font-size: 11px !important;
  line-height: 1.4 !important;
}

.cart-summary .ara-option-check {
  display: grid !important;
  width: 22px !important;
  height: 22px !important;
  place-items: center !important;
  border: 1.5px solid #d6c1b1 !important;
  border-radius: 7px !important;
  background: #fff !important;
  color: transparent !important;
  box-sizing: border-box !important;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.cart-summary .ara-invoice-option.is-selected .ara-option-check,
.cart-summary .ara-policy-option.is-selected .ara-option-check {
  border-color: #a9643d !important;
  background: #a9643d !important;
  color: #fff !important;
  transform: scale(1.03);
}

.cart-summary .ara-invoice-email {
  position: relative !important;
  display: flex !important;
  width: 100% !important;
  height: auto !important;
  margin: 13px 0 0 !important;
  overflow: visible !important;
}

.cart-summary .cart-checkout-summary {
  position: relative !important;
  inset: auto !important;
  display: block !important;
  clear: both !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  margin: 18px 0 0 !important;
  padding-top: 16px !important;
  overflow: visible !important;
  transform: none !important;
}

.cart-summary .cart-checkout-summary > div {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  min-width: 0 !important;
}

.cart-summary .cart-checkout-total {
  margin-top: 10px !important;
}

.cart-summary .cart-policy-link,
.cart-summary .cart-checkout-submit {
  position: relative !important;
  inset: auto !important;
  display: flex !important;
  width: 100% !important;
  transform: none !important;
}

@container (min-width: 520px) {
  .cart-summary .ara-payment-options {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .cart-summary .ara-payment-card {
    min-height: 94px !important;
  }
}

@media (max-width: 520px) {
  .cart-summary .ara-payment-options {
    grid-template-columns: 1fr !important;
  }
}
`;



function normalizePhoneInput(value) {
  return String(value || "").replace(/[^\d+\s.-]/g, "");
}

function isVietnamesePhone(value) {
  const phone = String(value || "").replace(/[\s.-]/g, "");
  return /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/.test(phone);
}

function getInitialCheckoutStep(info) {
  if (isVietnamesePhone(info?.phone)) return 2;
  if (String(info?.fullName || "").trim().length >= 2) return 1;
  return 0;
}

export function RentalCartPage(props) {
  const { user, setView } = props;
  const navigate = useNavigate();
  const userId = user?.id || user?._id;

  const phoneInputRef = useRef(null);
  const invoiceEmailInputRef = useRef(null);
  const fulfillmentRef = useRef(null);
  const submitRef = useRef(false);
  const voucherBusyRef = useRef(false);
  const restoreVoucherRef = useRef(Boolean(savedCheckoutVoucher()));
  const voucherRevalidationRef = useRef("");
  const idempotencyRef = useRef({ fingerprint: "", key: "" });

  const [items, setItems] = useState(() => getRentalCart(userId));
  const [agreed, setAgreed] = useState(false);
  const [carrierFeeAccepted, setCarrierFeeAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const showNotice = (message, type = "success") => {
    if (!message) return;

    const notifier = props?.notify;

    if (typeof notifier === "function") {
      notifier(message, type);
      return;
    }

    if (type === "error") {
      console.error("[RentalCartPage]", message);
    } else {
      console.log("[RentalCartPage]", message);
    }
  };

  const assistedPrefill=useMemo(()=>assistedCheckoutPrefill(),[]);
  const cartFulfillment = items[0]?.fulfillment || scheduledFulfillmentPrefill();
  const [guestInfo, setGuestInfo] = useState({
    fullName: user?.name || user?.fullName || "",
    phone: user?.phone || "",
    email: user?.email || "",
    invoiceRequested: false,
    invoiceEmail: "",
    paymentPreference: "bank_transfer"
    ,pickupMethod:cartFulfillment.pickupMethod||"store_pickup",collectionSameAsDelivery:true,
    deliveryAddressId:cartFulfillment.deliveryAddressId||"",collectionAddressId:cartFulfillment.deliveryAddressId||"",
    addressLine:"",communeCode:"",wardName:"",districtCode:"",districtName:"",provinceCode:"",provinceName:"",
    collectionAddressLine:"",collectionCommuneCode:"",collectionWardName:"",collectionDistrictCode:"",collectionDistrictName:"",collectionProvinceCode:"",collectionProvinceName:"",
    ...(cartFulfillment.deliveryAddress||{}),
    ...assistedPrefill,
    ...(assistedPrefill.deliveryAddress||{}),
    ...(assistedPrefill.collectionAddress ? {
      collectionAddressLine: assistedPrefill.collectionAddress.addressLine || "",
      collectionWardName: assistedPrefill.collectionAddress.wardName || "",
      collectionDistrictCode: assistedPrefill.collectionAddress.districtCode || "",
      collectionDistrictName: assistedPrefill.collectionAddress.districtName || "",
      collectionProvinceCode: assistedPrefill.collectionAddress.provinceCode || "",
      collectionProvinceName: assistedPrefill.collectionAddress.provinceName || ""
    } : {}),
    returnMethod: "store_return"
  });
  const [shippingQuote,setShippingQuote]=useState({feeMode:"external_direct_payment",feeAmount:null,chargedByShop:false,outboundFee:null,returnFee:null,totalShippingFee:null});
  const [voucherCode, setVoucherCode] = useState(savedCheckoutVoucher);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [savedAddresses,setSavedAddresses]=useState([]);

  const [checkoutStep, setCheckoutStep] = useState(() =>
    getInitialCheckoutStep({
      fullName: user?.name || user?.fullName || "",
      phone: user?.phone || ""
    })
  );

  useEffect(() => {
    setItems(getRentalCart(userId));
  }, [userId]);

  useEffect(() => {
    if (!user) return;

    setGuestInfo((current) => {
      const next = {
        ...current,
        fullName: user.name || user.fullName || current.fullName,
        phone: user.phone || current.phone,
        email: user.email || current.email
      };

      setCheckoutStep((step) =>
        Math.max(step, getInitialCheckoutStep(next))
      );

      return next;
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSavedAddresses([]);
      return;
    }
    let active = true;
    listAddresses()
      .then((items) => {
        if (!active) return;
        const enabled = (Array.isArray(items) ? items : []).filter((item) => item.isEnabled !== false);
        setSavedAddresses(enabled);
        const preferred = enabled.find((item) => item.isDefault) || enabled[0];
        if (!preferred) return;
        setGuestInfo((current) => current.deliveryAddressId ? current : {
          ...current,
          deliveryAddressId: preferred._id,
          collectionAddressId: preferred._id,
          addressLine: preferred.addressLine || "",
          wardName: preferred.wardName || "",
          districtCode: preferred.districtCode || "",
          districtName: preferred.districtName || "",
          provinceCode: preferred.provinceCode || "",
          provinceName: preferred.provinceName || "",
          collectionAddressLine: preferred.addressLine || "",
          collectionWardName: preferred.wardName || "",
          collectionDistrictCode: preferred.districtCode || "",
          collectionDistrictName: preferred.districtName || "",
          collectionProvinceCode: preferred.provinceCode || "",
          collectionProvinceName: preferred.provinceName || ""
        });
      })
      .catch(() => setSavedAddresses([]));
    return () => { active = false; };
  }, [user]);

  const chooseSavedAddress = (kind) => (event) => {
    const id = event.target.value;
    const address = savedAddresses.find((item) => String(item._id) === id);
    const prefix = kind === "delivery" ? "" : "collection";
    setGuestInfo((current) => ({
      ...current,
      [kind === "delivery" ? "deliveryAddressId" : "collectionAddressId"]: id,
      ...(address ? {
        [prefix ? "collectionAddressLine" : "addressLine"]: address.addressLine || "",
        [prefix ? "collectionWardName" : "wardName"]: address.wardName || "",
        [prefix ? "collectionDistrictCode" : "districtCode"]: address.districtCode || "",
        [prefix ? "collectionDistrictName" : "districtName"]: address.districtName || "",
        [prefix ? "collectionProvinceCode" : "provinceCode"]: address.provinceCode || "",
        [prefix ? "collectionProvinceName" : "provinceName"]: address.provinceName || ""
      } : {})
    }));
  };

  useEffect(() => {
    if (!items.length) {
      setScheduleError("");
      setShippingQuote({feeMode:"not_applicable",feeAmount:0,chargedByShop:false,outboundFee:0,returnFee:0,totalShippingFee:0});
      return undefined;
    }
    const needsDelivery = guestInfo.pickupMethod === "home_delivery";
    if (needsDelivery && (!guestInfo.addressLine || !guestInfo.provinceCode || !guestInfo.districtCode || !guestInfo.communeCode)) {
      setScheduleError("");
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const first = items[0];
        const quote = await quoteRentalOrder({
          pickupMethod:guestInfo.pickupMethod,returnMethod:guestInfo.returnMethod,
          requestedStartAt:first?.rentalDate,
          rentalDays:Number(first?.rentalDays) || 1,
          items:items.map((item) => ({
            costumeId:item.product?.id || item.product?._id,
            quantity:Number(item.quantity) || 1
          })),
          receiver:{fullName:guestInfo.fullName,phone:guestInfo.phone},
          deliveryAddress:guestInfo.pickupMethod==="home_delivery"
            ? guestInfo.deliveryAddressId
              ? {addressId:guestInfo.deliveryAddressId}
              : {address:{addressLine:guestInfo.addressLine,communeCode:guestInfo.communeCode,wardName:guestInfo.wardName,districtCode:guestInfo.districtCode,districtName:guestInfo.districtName,provinceCode:guestInfo.provinceCode,provinceName:guestInfo.provinceName}}
            : undefined
        }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setScheduleError("");
        setShippingQuote({
          feeMode:quote?.feeMode || "external_direct_payment",
          feeAmount:quote?.feeAmount ?? null,
          chargedByShop:quote?.chargedByShop === true,
          outboundFee:quote?.pricing?.deliveryFee ?? null,
          returnFee:quote?.pricing?.collectionFee ?? null,
          totalShippingFee:quote?.pricing?.transportTotal ?? null
        });
      } catch (error) {
        if (controller.signal.aborted || error?.name === "CanceledError" || error?.name === "AbortError") return;
        const message = error?.response?.data?.message || error?.response?.data?.error || error.message;
        const isScheduleIssue = /thời điểm|giờ (?:giao nhận|hoạt động)|phải về cửa hàng/i.test(String(message || ""));
        setScheduleError(isScheduleIssue ? message : "");
        setShippingQuote({
          feeMode:"external_direct_payment",feeAmount:null,chargedByShop:false,
          outboundFee:null,
          returnFee:null,
          totalShippingFee:null,
          error:isScheduleIssue ? "" : message
        });
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [items,guestInfo.pickupMethod,guestInfo.returnMethod,guestInfo.deliveryAddressId,guestInfo.addressLine,guestInfo.communeCode,guestInfo.wardName,guestInfo.districtCode,guestInfo.districtName,guestInfo.provinceCode,guestInfo.provinceName,guestInfo.fullName,guestInfo.phone]);

  const revealCheckoutStep = (nextStep) => {
    setCheckoutStep((current) => Math.max(current, nextStep));
  };

  const focusInput = (ref) => {
    window.requestAnimationFrame(() => ref.current?.focus());
  };

  const updateGuestInfo = (field) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;

    setGuestInfo((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateFullName = (event) => {
    const value = event.target.value;

    setGuestInfo((current) => ({
      ...current,
      fullName: value
    }));

    if (value.trim().length >= 2) {
      revealCheckoutStep(1);
    }
  };

  const updatePhone = (event) => {
    const value = normalizePhoneInput(event.target.value);

    setGuestInfo((current) => ({
      ...current,
      phone: value
    }));

    if (isVietnamesePhone(value)) {
      revealCheckoutStep(2);
    }
  };

  const updateEmail = (event) => {
    const value = event.target.value;

    setGuestInfo((current) => ({
      ...current,
      email: value,
      invoiceEmail:
        current.invoiceRequested && !current.invoiceEmail
          ? value
          : current.invoiceEmail
    }));
  };

  const toggleInvoice = (event) => {
    const checked = event.target.checked;

    setGuestInfo((current) => ({
      ...current,
      invoiceRequested: checked,
      invoiceEmail: checked
        ? current.invoiceEmail || current.email
        : ""
    }));
  };

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const product = item.product || {};
        const pricing = item.quote?.pricing;
        const rentalAmount = Number(pricing?.totalRentalAmount ?? product.rentalPricePerDay ?? 0);

        return (
          sum +
          rentalAmount +
          (Number(product.depositAmount) || 0)
        );
      }, 0),
    [items]
  );

  const voucherFingerprint = useMemo(() => JSON.stringify({
    userId: userId || "guest",
    phone: guestInfo.phone,
    items: items.map((item) => ({
      costumeId: item.product?.id || item.product?._id,
      quantity: Number(item.quantity) || 1,
      rentalDate: item.rentalDate,
      returnDate: item.returnDate,
      rentalDays: item.rentalDays,
      mainUseDate: item.mainUseDate,
      pickupTime: item.pickupTime,
      returnTime: item.returnTime,
      extraDays: item.extraDays
    }))
  }), [items, userId, guestInfo.phone]);

  async function applyVoucherCode(code, { silent = false } = {}) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!user || !normalizedCode || !items.length) return;
    if (voucherBusyRef.current) {
      voucherRevalidationRef.current = normalizedCode;
      return;
    }
    voucherBusyRef.current = true;
    setVoucherBusy(true);
    setVoucherError("");
    try {
      const first = items[0] || {};
      const result = await applyVoucher({
        code: normalizedCode,
        rentalDays: Number(first.rentalDays) || 1,
        mainUseDate: first.mainUseDate || "",
        pickupTime: first.pickupTime || "",
        returnTime: first.returnTime || "",
        extraDays: Number(first.extraDays || 0),
        items: items.map((item) => ({
          costumeId: item.product?.id || item.product?._id,
          quantity: Number(item.quantity) || 1
        }))
      });
      setVoucherCode(normalizedCode);
      setAppliedVoucher({ ...result, fingerprint: voucherFingerprint });
      sessionStorage.setItem("ara_checkout_voucher", normalizedCode);
      if (!silent) showNotice("Áp dụng voucher thành công.");
    } catch (error) {
      setAppliedVoucher(null);
      sessionStorage.removeItem("ara_checkout_voucher");
      setVoucherError(error.message || "Không thể áp dụng voucher.");
      if (!silent) showNotice(error.message || "Không thể áp dụng voucher.", "error");
    } finally {
      voucherBusyRef.current = false;
      setVoucherBusy(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setAppliedVoucher(null);
      setVoucherCode("");
      sessionStorage.removeItem("ara_checkout_voucher");
      return undefined;
    }
    if (!items.length) {
      setAppliedVoucher(null);
      sessionStorage.removeItem("ara_checkout_voucher");
      return undefined;
    }
    const shouldRestore = restoreVoucherRef.current;
    const pendingCode = voucherRevalidationRef.current;
    const fingerprintMismatch = Boolean(appliedVoucher?.voucher?.code && appliedVoucher.fingerprint !== voucherFingerprint);
    if (!shouldRestore && !fingerprintMismatch && !pendingCode) return undefined;
    const code = pendingCode || appliedVoucher?.voucher?.code || voucherCode;
    if (fingerprintMismatch && !pendingCode) {
      voucherRevalidationRef.current = code;
      setAppliedVoucher(null);
      return undefined;
    }
    if (voucherBusyRef.current) return undefined;
    voucherRevalidationRef.current = "";
    restoreVoucherRef.current = false;
    const timer = window.setTimeout(() => applyVoucherCode(code, { silent: true }), 250);
    return () => window.clearTimeout(timer);
  }, [user, voucherBusy, voucherFingerprint, appliedVoucher?.voucher?.code, appliedVoucher?.fingerprint]);

  const removeVoucherCode = () => {
    setAppliedVoucher(null);
    setVoucherCode("");
    setVoucherError("");
    sessionStorage.removeItem("ara_checkout_voucher");
  };

  const discountAmount = Math.max(0, Number(appliedVoucher?.discountAmount) || 0);
  const checkoutTotal = Math.max(0, total - discountAmount);

  const remove = (itemId) => {
    removeFromRentalCart(itemId, userId);
    setItems(getRentalCart(userId));
    showNotice("Đã xóa trang phục khỏi giỏ thuê.");
  };

  const submit = async () => {
    if (submitRef.current) return;

    const fullName = guestInfo.fullName.trim();
    const phone = guestInfo.phone.trim();
    const email = guestInfo.email.trim().toLowerCase();
    const invoiceEmail = String(
      guestInfo.invoiceEmail || email
    )
      .trim()
      .toLowerCase();

    if (!fullName) {
      showNotice("Vui lòng nhập họ và tên.", "error");
      return;
    }

    if (!phone) {
      revealCheckoutStep(1);
      focusInput(phoneInputRef);
      showNotice("Vui lòng nhập số điện thoại.", "error");
      return;
    }

    if (!isVietnamesePhone(phone)) {
      revealCheckoutStep(1);
      focusInput(phoneInputRef);
      showNotice("Số điện thoại không hợp lệ.", "error");
      return;
    }

    if (email && !EMAIL_PATTERN.test(email)) {
      revealCheckoutStep(2);
      showNotice("Email không hợp lệ.", "error");
      return;
    }
    if (
      guestInfo.invoiceRequested &&
      !EMAIL_PATTERN.test(invoiceEmail)
    ) {
      revealCheckoutStep(2);

      window.requestAnimationFrame(() => {
        invoiceEmailInputRef.current?.focus();
      });

      showNotice(
        "Vui lòng nhập email nhận hóa đơn hợp lệ.",
        "error"
      );
      return;
    }

    if (!agreed) {
      showNotice(
        "Vui lòng đọc và đồng ý với chính sách thuê đồ.",
        "error"
      );
      return;
    }
    const usesExternalCarrier = guestInfo.pickupMethod === "home_delivery";
    const deliveryProvince = String(guestInfo.provinceCode || "").padStart(2, "0");
    if (guestInfo.pickupMethod === "home_delivery" && deliveryProvince !== "79") {
      showNotice("Hiện tại shop chỉ hỗ trợ giao tận nơi trong TP.HCM. Bạn có thể chọn nhận và trả tại shop hoặc sử dụng địa chỉ tại TP.HCM.", "error");
      return;
    }
    if (usesExternalCarrier && !carrierFeeAccepted) {
      showNotice("Vui lòng xác nhận phí giao/nhận được thanh toán trực tiếp cho shipper.", "error");
      return;
    }
    if (guestInfo.pickupMethod === "home_delivery" && guestInfo.paymentPreference === "cash") {
      showNotice("Giao tận nơi không hỗ trợ thanh toán tiền thuê bằng tiền mặt.", "error");
      return;
    }

    if (!items.length) {
      showNotice("Giỏ thuê đang trống.", "error");
      return;
    }

    if (scheduleError) {
      revealCheckoutStep(2);
      window.requestAnimationFrame(() => {
        fulfillmentRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      });
      showNotice(scheduleError, "error");
      return;
    }

    const first = items[0];

    const sameRentalSchedule = items.every(
      (item) =>
        item.rentalDate === first.rentalDate &&
        item.returnDate === first.returnDate
    );

    if (!sameRentalSchedule) {
      showNotice(
        "Các trang phục trong cùng một đơn phải có cùng lịch thuê và lịch trả.",
        "error"
      );
      return;
    }

    const invalidItem = items.find(
      (item) => !(item.product?.id || item.product?._id)
    );

    if (invalidItem) {
      showNotice(
        "Có trang phục không hợp lệ trong giỏ thuê. Vui lòng xóa và thêm lại.",
        "error"
      );
      return;
    }

    const rentalStart = new Date(first.rentalDate);
    const rentalEnd = new Date(first.returnDate);

    if (
      Number.isNaN(rentalStart.getTime()) ||
      Number.isNaN(rentalEnd.getTime())
    ) {
      showNotice("Thời gian thuê không hợp lệ.", "error");
      return;
    }

    const calculatedRentalDays = Math.max(
      1,
      Math.ceil(
        (rentalEnd.getTime() - rentalStart.getTime()) / 86400000
      )
    );

    const rentalDays =
      Number(first.rentalDays) > 0
        ? Number(first.rentalDays)
        : calculatedRentalDays;

    submitRef.current = true;
    setLoading(true);

    try {
      for (const item of items) {
        const costumeId = item.product.id || item.product._id;
        const availability = await checkCostumeAvailability(
          costumeId,
          item.rentalDate,
          item.returnDate
        );

        if (!availability?.available) {
          showNotice(
            `${item.product.name} đã có người đặt trong thời gian này.`,
            "error"
          );
          return;
        }
      }

      const fingerprint = JSON.stringify({
        userId: userId || "guest",
        guestInfo,
        agreed,
        carrierFeeAccepted,
        voucherCode: user ? appliedVoucher?.voucher?.code || "" : "",
        items: items.map((item) => ({
          costumeId: item.product.id || item.product._id,
          quantity: Number(item.quantity) || 1,
          rentalDate: item.rentalDate,
          returnDate: item.returnDate
        }))
      });
      if (idempotencyRef.current.fingerprint !== fingerprint) {
        idempotencyRef.current = { fingerprint, key: newIdempotencyKey() };
      }
      const response = await createRentalOrder({
        customerInfo: {
          fullName,
          phone,
          email
        },
        invoice: {
          requested: Boolean(guestInfo.invoiceRequested),
          email: guestInfo.invoiceRequested ? invoiceEmail : ""
        },
        policyAccepted: true,
        policyVersion: RENTAL_POLICY_VERSION,
        paymentPreference: guestInfo.paymentPreference,
        externalCarrierFeeAccepted: usesExternalCarrier ? carrierFeeAccepted : false,
        pickupMethod:guestInfo.pickupMethod,
        returnMethod:guestInfo.returnMethod,
        requestedStartAt:first.rentalDate,
        idempotencyKey:idempotencyRef.current.key,
        voucherCode: user ? appliedVoucher?.voucher?.code || undefined : undefined,
        fulfillment: {
          pickupMethod:guestInfo.pickupMethod,
          returnMethod:guestInfo.returnMethod,
          receiver: { fullName, phone },
          deliveryAddress:guestInfo.pickupMethod==="home_delivery"?(guestInfo.deliveryAddressId?{addressId:guestInfo.deliveryAddressId}:{address:{addressLine:guestInfo.addressLine,communeCode:guestInfo.communeCode,wardName:guestInfo.wardName,districtCode:guestInfo.districtCode,districtName:guestInfo.districtName,provinceCode:guestInfo.provinceCode,provinceName:guestInfo.provinceName}}):undefined,
        },
        rentalDate: first.rentalDate,
        rentalDays,
        mainUseDate: first.mainUseDate,
        pickupTime: first.pickupTime,
        returnTime: first.returnTime,
        extraDays: Number(first.extraDays || 0),
        items: items.map((item) => ({
          costumeId: item.product.id || item.product._id,
          quantity: Number(item.quantity) || 1
        })),
        note: ""
      });

      clearRentalCart(userId);
      sessionStorage.removeItem("ara_checkout_voucher");
      localStorage.removeItem("ara_assisted_checkout");
      setItems([]);

      if (!user) {
        saveGuestOrderSession({
          orderId: response._id || response.order?.id,
          orderCode: response.orderCode || response.order?.orderCode,
          token: response.guestOrderAccessToken,
          expiresAt: response.guestOrderTokenExpiresAt
        });
        const receipt = {
          orderId: response._id,
          orderCode: response.orderCode,
          guestOrderAccessToken: response.guestOrderAccessToken,
          status: response.status,
          customerInfo: response.customerInfo,
          rentalDate: response.rentalDate,
          returnDate: response.returnDate,
          itemCount: (response.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          totalRentalPrice: response.totalRentalPrice,
          totalDepositAmount: response.totalDepositAmount,
          paymentPreference: response.paymentPreference || guestInfo.paymentPreference
        };
        sessionStorage.setItem("ara_last_rental_receipt", JSON.stringify(receipt));
        setView(views.rentalOrderSuccess, paths.rentalOrderSuccess(response.orderCode));
        return;
      }

      showNotice(
        response?.message ||
        response?.data?.message ||
        (user
          ? "Đơn thuê đã được tạo."
          : "Đơn thuê đã được tạo. Bạn có thể xác minh số điện thoại để theo dõi đơn.")
      );

      const createdOrderId = response?._id || response?.id || response?.order?._id || response?.order?.id;
      if (!createdOrderId) throw new Error("API tạo đơn không trả về mã định danh đơn thuê.");
      navigate(paths.orderDetail(createdOrderId), { replace: true });
    } catch (error) {
      const responseData = error?.response?.data;
      const errorMessage =
        responseData?.message ||
        responseData?.error ||
        error?.message ||
        "Không thể tạo đơn thuê.";
      const isScheduleIssue =
        /thời điểm|giờ (?:giao nhận|hoạt động)|phải về cửa hàng/i.test(
          String(errorMessage)
        );

      if (isScheduleIssue) {
        setScheduleError(errorMessage);
        revealCheckoutStep(2);
        window.requestAnimationFrame(() => {
          fulfillmentRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        });
      }

      showNotice(
        responseData?.message ||
        responseData?.error ||
        error?.message ||
        "Không thể tạo đơn thuê.",
        "error"
      );
    } finally {
      submitRef.current = false;
      setLoading(false);
    }
  };

  return (
    <section className="cart-page">
      <style>{CHECKOUT_OPTION_STYLES}</style>
      <div className="mei-page-title">
        <h1>Giỏ thuê</h1>
        <p>
          Kiểm tra lịch trống và xác nhận chính sách trước khi tạo
          đơn thuê.
        </p>
      </div>

      {items.length === 0 && (
        <StateMessage text="Giỏ thuê của bạn đang trống. Chọn một trang phục và khung giờ để bắt đầu." actionLabel="Xem trang phục" onAction={() => setView(views.catalog, paths.catalog)} />
      )}

      {items.length > 0 && <div className="cart-layout">
        <div className="cart-items">
          {items.map((item, index) => {
            const product = item.product || {};
            const productId = product.id || product._id;

            const image = resolveImageUrl(
              product.image ||
              product.images?.[0] ||
              fallbackImages[index % fallbackImages.length]
            );

            const rentalLabel = item.rentalDate?.includes("T")
              ? formatDateTime(item.rentalDate)
              : formatDate(item.rentalDate);

            const returnLabel = item.returnDate?.includes("T")
              ? formatDateTime(item.returnDate)
              : formatDate(item.returnDate);

            const pricing = item.quote?.pricing;
            const rentalAmount = Number(pricing?.totalRentalAmount ?? product.rentalPricePerDay ?? 0);

            const lineTotal =
              rentalAmount +
              (Number(product.depositAmount) || 0);

            return (
              <article
                className="cart-item panel"
                key={item.id || item._id || `${productId}-${index}`}
              >
                <button
                  className="cart-item-image"
                  type="button"
                  onClick={() =>
                    setView(
                      views.detail,
                      paths.detail(productId)
                    )
                  }
                  aria-label={`Xem chi tiết ${product.name || "trang phục"
                    }`}
                >
                  <img
                    src={image}
                    alt={product.name || "Trang phục"}
                    onError={(event) => {
                      event.currentTarget.src = "/placeholder.png";
                    }}
                  />
                </button>

                <div className="cart-item-info">
                  <h2>{product.name}</h2>

                  <div className="cart-item-meta">
                    <span>
                      Ngày nhận <strong>{rentalLabel}</strong>
                    </span>

                    <span>
                      Ngày trả <strong>{returnLabel}</strong>
                    </span>

                    <span>
                      Giá gói <strong>{money(product.rentalPricePerDay)} · {Number(item.rentalDays || 1)} ngày ({Number(item.rentalDays || 1) * 24} giờ)</strong>
                    </span>

                    <span>
                      Ngày mặc chính <strong>{item.mainUseDate ? formatDate(item.mainUseDate) : "Đơn theo lịch cũ"}</strong>
                    </span>

                    {Number(item.extraDays || 0) > 0 && (
                      <span>
                        Giữ thêm <strong>{item.extraDays} ngày · {money(pricing?.extraDayFee)}</strong>
                      </span>
                    )}

                    <span>
                      Tiền cọc{" "}
                      <strong>{money(product.depositAmount)}</strong>
                    </span>
                  </div>

                  <strong className="cart-line-total">
                    Tổng: {money(lineTotal)}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => remove(item.id || item._id)}
                  aria-label="Xóa khỏi giỏ"
                >
                  <Trash2 size={18} />
                </button>
              </article>
            );
          })}
        </div>

        <form
          className="cart-summary panel"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <header className="cart-summary-header">
            <span>ARA CHECKOUT</span>
            <h2>Tóm tắt đơn thuê</h2>
            <p>
              Điền thông tin liên hệ để cửa hàng xác nhận đơn.
            </p>
          </header>

          <div className="cart-progressive-fields">
            <label className="cart-checkout-field">
              <span>
                Họ và tên <b>*</b>
              </span>

              <div className="cart-checkout-input">
                <UserRound size={19} strokeWidth={1.7} />

                <input
                  value={guestInfo.fullName}
                  onChange={updateFullName}
                  onBlur={() => {
                    if (
                      guestInfo.fullName.trim().length >= 2
                    ) {
                      revealCheckoutStep(1);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      guestInfo.fullName.trim().length >= 2
                    ) {
                      event.preventDefault();
                      revealCheckoutStep(1);
                      focusInput(phoneInputRef);
                    }
                  }}
                  placeholder="Nhập họ và tên"
                  autoComplete="name"
                  required
                />
              </div>
            </label>

            <div
              className={`cart-progressive-step ${checkoutStep >= 1 ? "is-visible" : ""
                }`}
              aria-hidden={checkoutStep < 1}
            >
              <label className="cart-checkout-field">
                <span>
                  Số điện thoại <b>*</b>
                </span>

                <div className="cart-checkout-input">
                  <Phone size={19} strokeWidth={1.7} />

                  <input
                    ref={phoneInputRef}
                    type="tel"
                    inputMode="tel"
                    value={guestInfo.phone}
                    onChange={updatePhone}
                    onBlur={() => {
                      if (isVietnamesePhone(guestInfo.phone)) {
                        revealCheckoutStep(2);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        isVietnamesePhone(guestInfo.phone)
                      ) {
                        event.preventDefault();
                        revealCheckoutStep(2);
                      }
                    }}
                    placeholder="Nhập số điện thoại"
                    autoComplete="tel"
                    tabIndex={checkoutStep >= 1 ? 0 : -1}
                    required
                  />
                </div>
              </label>
            </div>


            <div
              className={`cart-progressive-step ${checkoutStep >= 2 ? "is-visible" : ""
                }`}
              aria-hidden={checkoutStep < 2}
            >
              <div className="cart-invoice-section">
                <fieldset ref={fulfillmentRef} className="ara-payment-fieldset ara-fulfillment-fieldset ara-checkout-fulfillment-review">
                  <legend className="ara-payment-legend">Thiết lập nhận và trả</legend>
                  <p className="ara-fulfillment-hint">Thời gian thuê chỉ bắt đầu khi bạn thực nhận đồ và dừng khi bạn giao đồ trả cho shipper hoặc trả tại shop.</p>
                  {scheduleError && (
                    <div className="ara-schedule-warning" role="alert">
                      <span className="ara-schedule-warning-icon" aria-hidden="true">
                        <CalendarClock size={21} strokeWidth={1.8}/>
                      </span>
                      <span className="ara-schedule-warning-copy">
                        <strong>Lịch nhận – trả chưa phù hợp</strong>
                        <span>{scheduleError} Vui lòng chọn lại giờ trong phần đặt lịch.</span>
                        <button
                          type="button"
                          onClick={() => {
                            const productId = items[0]?.product?.id || items[0]?.product?._id;
                            if (productId) {
                              sessionStorage.setItem(
                                "ara_schedule_adjustment_notice",
                                scheduleError
                              );
                              sessionStorage.setItem(
                                "ara_schedule_fulfillment",
                                JSON.stringify({
                                  pickupMethod: guestInfo.pickupMethod,
                                  returnMethod: guestInfo.returnMethod,
                                  deliveryAddressId: guestInfo.deliveryAddressId,
                                  deliveryAddress: {
                                    addressLine: guestInfo.addressLine,
                                    wardName: guestInfo.wardName,
                                    districtName: guestInfo.districtName,
                                    provinceName: guestInfo.provinceName,
                                    provinceCode: guestInfo.provinceCode
                                  }
                                })
                              );
                              setView(views.detail, paths.detail(productId));
                            }
                          }}
                        >
                          Chọn lại thời gian
                        </button>
                      </span>
                    </div>
                  )}
                  <div className="ara-fulfillment-review-card">
                    <div>
                      <span>Cách nhận đồ</span>
                      <strong>{guestInfo.pickupMethod === "home_delivery" ? "Giao tận nơi" : "Tự nhận tại cửa hàng"}</strong>
                    </div>
                    <div>
                      <span>Cách trả đồ</span>
                      <strong>Tự trả tại cửa hàng</strong>
                    </div>
                    {guestInfo.pickupMethod === "home_delivery" && (
                      <div className="is-wide">
                        <span>Địa chỉ giao nhận đã chọn</span>
                        <strong>{[guestInfo.addressLine, guestInfo.wardName, guestInfo.districtName, guestInfo.provinceName].filter(Boolean).join(", ")}</strong>
                        <small>Muốn thay đổi, vui lòng quay lại phần chọn lịch của trang phục.</small>
                      </div>
                    )}
                  </div>
                  <strong className="ara-fulfillment-group-title">Cách nhận đồ</strong>
                  <div className="ara-fulfillment-options">
                    {[["store_pickup","Tự nhận tại cửa hàng","Nhận trực tiếp tại ARA"],["home_delivery","Giao tận nơi","ARA giao đến địa chỉ của bạn"]].map(([value,title,copy])=><label className={guestInfo.pickupMethod===value?"is-selected":""} key={value}><input type="radio" className="ara-visually-hidden-input" name="pickupMethod" value={value} checked={guestInfo.pickupMethod===value} onChange={updateGuestInfo("pickupMethod")}/><span><strong>{title}</strong><small>{copy}</small></span><i/></label>)}
                  </div>
                  {guestInfo.pickupMethod==="home_delivery"&&<div className="ara-shipping-address"><div className="ara-shipping-address-head"><MapPin size={18}/><span><strong>Địa chỉ giao đồ tại TP.HCM</strong><small>Shop hiện chỉ hỗ trợ giao tận nơi trong TP.HCM.</small></span></div><SavedAddressPicker addresses={savedAddresses.filter((item)=>String(item.provinceCode||"").padStart(2,"0")==="79")} value={guestInfo.deliveryAddressId} onChange={chooseSavedAddress("delivery")}/>{!guestInfo.deliveryAddressId&&<><AddressLocationFields allowedProvinceCodes={["79"]} provinceCode={guestInfo.provinceCode} districtCode={guestInfo.districtCode} communeCode={guestInfo.communeCode} onChange={(next)=>setGuestInfo((current)=>({...current,...next,wardName:next.communeName??current.wardName}))}/><label className="wide"><span>Số nhà, tên đường *</span><input required value={guestInfo.addressLine} onChange={updateGuestInfo("addressLine")}/></label></>}</div>}
                  {shippingQuote.error?<p className="form-error">{shippingQuote.error}</p>:(guestInfo.pickupMethod==="home_delivery")&&<div className="ara-shipping-quote"><div><strong>Phí giao hàng thanh toán riêng</strong><span>Shop sẽ liên hệ đơn vị vận chuyển. Chi phí thực tế được thanh toán trực tiếp cho shipper và không nằm trong tổng đơn thuê.</span></div><label><input type="checkbox" checked={carrierFeeAccepted} onChange={(event)=>setCarrierFeeAccepted(event.target.checked)}/><span>Tôi hiểu và đồng ý thanh toán phí giao hàng trực tiếp cho đơn vị vận chuyển.</span></label></div>}
                </fieldset>
                <fieldset className="ara-payment-fieldset">
                  <legend className="ara-payment-legend">
                    Phương thức thanh toán
                  </legend>

                  <div className="ara-payment-options">
                    <label
                      className={`ara-payment-card ${
                        guestInfo.paymentPreference === "cash"
                          ? "is-selected"
                          : ""
                      }`}
                    >
                      <input
                        className="ara-visually-hidden-input"
                        type="radio"
                        name="paymentPreference"
                        value="cash"
                        disabled={guestInfo.pickupMethod === "home_delivery"}
                        checked={
                          guestInfo.paymentPreference === "cash"
                        }
                        onChange={updateGuestInfo(
                          "paymentPreference"
                        )}
                      />

                      <span
                        className="ara-payment-icon"
                        aria-hidden="true"
                      >
                        <Banknote size={22} strokeWidth={1.7} />
                      </span>

                      <span className="ara-payment-copy">
                        <strong>Tiền mặt</strong>
                        <small>{guestInfo.pickupMethod === "home_delivery" ? "Chỉ áp dụng khi nhận đồ tại shop" : "Thanh toán khi nhận đồ tại shop"}</small>
                      </span>

                      <span
                        className="ara-payment-radio"
                        aria-hidden="true"
                      />
                    </label>

                    <label
                      className={`ara-payment-card ${
                        guestInfo.paymentPreference ===
                        "bank_transfer"
                          ? "is-selected"
                          : ""
                      }`}
                    >
                      <input
                        className="ara-visually-hidden-input"
                        type="radio"
                        name="paymentPreference"
                        value="bank_transfer"
                        checked={
                          guestInfo.paymentPreference ===
                          "bank_transfer"
                        }
                        onChange={updateGuestInfo(
                          "paymentPreference"
                        )}
                      />

                      <span
                        className="ara-payment-icon"
                        aria-hidden="true"
                      >
                        <Landmark size={22} strokeWidth={1.7} />
                      </span>

                      <span className="ara-payment-copy">
                        <strong>Chuyển khoản</strong>
                        <small>Thanh toán bằng QR ngân hàng</small>
                      </span>

                      <span
                        className="ara-payment-radio"
                        aria-hidden="true"
                      />
                    </label>
                  </div>
                </fieldset>

                <label
                  className={`ara-invoice-option ${
                    guestInfo.invoiceRequested
                      ? "is-selected"
                      : ""
                  }`}
                >
                  <input
                    className="ara-visually-hidden-input"
                    type="checkbox"
                    checked={guestInfo.invoiceRequested}
                    onChange={toggleInvoice}
                  />

                  <span
                    className="ara-option-icon"
                    aria-hidden="true"
                  >
                    <ReceiptText size={19} strokeWidth={1.7} />
                  </span>

                  <span className="ara-option-copy">
                    <strong>Nhận hóa đơn điện tử</strong>
                    <small>
                      Hóa đơn sẽ được gửi qua email của bạn
                    </small>
                  </span>

                  <span
                    className="ara-option-check"
                    aria-hidden="true"
                  >
                    <Check size={14} strokeWidth={2.6} />
                  </span>
                </label>

                {guestInfo.invoiceRequested && (
                  <label className="cart-checkout-field ara-invoice-email">
                    <span>
                      Email nhận hóa đơn <b>*</b>
                    </span>

                    <div className="cart-checkout-input">
                      <Mail size={19} strokeWidth={1.7} />

                      <input
                        ref={invoiceEmailInputRef}
                        type="email"
                        value={guestInfo.invoiceEmail}
                        onChange={updateGuestInfo("invoiceEmail")}
                        placeholder="Nhập email nhận hóa đơn"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </label>
                )}
              </div>

            </div>
          </div>

          {user && <div className="cart-voucher-section" aria-labelledby="cart-voucher-title">
            <div className="cart-voucher-heading">
              <TicketPercent size={20} aria-hidden="true" />
              <div><strong id="cart-voucher-title">Mã ưu đãi</strong><span>Giảm trên tiền thuê đủ điều kiện, không giảm tiền cọc.</span></div>
            </div>
            <div className="cart-voucher-controls">
              <input
                value={voucherCode}
                onChange={(event) => {
                  setVoucherCode(event.target.value.toUpperCase());
                  setAppliedVoucher(null);
                  setVoucherError("");
                  sessionStorage.removeItem("ara_checkout_voucher");
                }}
                placeholder="Nhập mã ưu đãi"
                aria-label="Mã ưu đãi"
                disabled={voucherBusy}
              />
              <button type="button" onClick={() => applyVoucherCode(voucherCode)} disabled={voucherBusy || !voucherCode.trim()}>
                {voucherBusy ? "Đang kiểm tra…" : "Áp dụng"}
              </button>
              {appliedVoucher && <button type="button" className="cart-voucher-remove" onClick={removeVoucherCode} disabled={voucherBusy}>Xóa mã</button>}
            </div>
            {voucherError && <p className="form-error" role="alert">{voucherError}</p>}
            {appliedVoucher && (
              <div className="cart-voucher-applied" role="status">
                <span><strong>{appliedVoucher.voucher?.code}</strong> · {appliedVoucher.voucher?.name}</span>
                <strong>-{money(discountAmount)}</strong>
              </div>
            )}
          </div>}

          <div className="cart-checkout-summary">
            <div>
              <span>Số trang phục</span>
              <strong>{items.length}</strong>
            </div>

            <div className="cart-checkout-total">
              <span>Tổng dự kiến</span>
              <strong>{money(checkoutTotal)}</strong>
              {guestInfo.pickupMethod==="home_delivery"&&<small>Phí giao hàng trả trực tiếp cho shipper, không nằm trong tổng này.</small>}
            </div>
          </div>

          <div className="cart-checkout-actions">
            <label
              className={`ara-policy-option ${
                agreed ? "is-selected" : ""
              }`}
            >
            <input
              className="ara-visually-hidden-input"
              type="checkbox"
              checked={agreed}
              onChange={(event) =>
                setAgreed(event.target.checked)
              }
            />

            <span
              className="ara-option-icon"
              aria-hidden="true"
            >
              <ReceiptText size={19} strokeWidth={1.7} />
            </span>

            <span className="ara-option-copy">
              <strong>
                Tôi đã đọc và đồng ý với chính sách thuê đồ
              </strong>
            </span>

            <span
              className="ara-option-check"
              aria-hidden="true"
            >
              <Check size={14} strokeWidth={2.6} />
            </span>
            </label>

            <button
              type="button"
              className="cart-policy-link"
              onClick={() =>
                setView(views.policy, paths.policy)
              }
            >
              Xem chính sách thuê đồ
            </button>

            <button
              type="submit"
              className="cart-checkout-submit"
              disabled={loading || !items.length}
            >
              <span>
                {loading ? "Đang tạo đơn..." : "Tạo đơn thuê"}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>}
    </section>
  );
}
