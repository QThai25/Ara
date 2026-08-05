import React from "react";
import {
  Facebook,
  Instagram,
  Phone
} from "lucide-react";
import { AriBunny } from "../petAra/AriBunny.jsx";
import { useAriMascot } from "../../context/AriMascotContext.jsx";
import { AraChatWidget } from "./AraChatWidget.jsx";

function emitMascotEvent(name, detail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(name, {
      detail
    })
  );
}

function ContactLink({
  type,
  href,
  label,
  children,
  external = false
}) {
  const {
    showAriMessage,
    celebrateAri,
    clearReaction
  } = useAriMascot();
  const messages = {
    phone: {
      focus: "Gọi ARA nha, Ari nghe máy cùng bạn nè 📞",
      click: "Ari mở hotline cho bạn nha!"
    },
    instagram: {
      focus: "Qua Instagram xem vibe mới với Ari nha ✨",
      click: "Ari mở Instagram rồi nè!"
    },
    facebook: {
      focus: "Nhắn ARA trên Facebook nếu bạn cần tư vấn nha.",
      click: "Ari đang chờ tin nhắn đó!"
    }
  };
  const currentMessage = messages[type];
  const focusMascot = () => {
    showAriMessage({
      type: "contact",
      message: currentMessage?.focus || "Ari ở đây nếu bạn cần nha.",
      duration: 0
    });

    emitMascotEvent("ara-mascot-contact-focus", {
      target: type
    });
  };

  const releaseMascot = () => {
    clearReaction();

    emitMascotEvent("ara-mascot-contact-focus", {
      target: null
    });
  };

  const reactMascot = () => {
    celebrateAri(currentMessage?.click || "Ari mở liên hệ cho bạn nha ✨");

    emitMascotEvent("ara-mascot-contact-reaction", {
      type
    });
  };

  return (
    <a
      className={`floating-contact__link floating-contact__link--${type}`}
      href={href}
      aria-label={label}
      title={label}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onPointerEnter={focusMascot}
      onPointerLeave={releaseMascot}
      onFocus={focusMascot}
      onBlur={releaseMascot}
      onClick={reactMascot}
    >
      {children}
    </a>
  );
}

export function FloatingContact({ interaction, message, user }) {
  const [chatOpen,setChatOpen]=React.useState(()=>new URLSearchParams(window.location.search).has("chat"));
  const [unread,setUnread]=React.useState(0);
  const [formFocused, setFormFocused] = React.useState(false);
  React.useEffect(() => {
    const isFormControl = (target) => target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    const onFocusIn = (event) => { if (isFormControl(event.target)) setFormFocused(true); };
    const onFocusOut = () => window.setTimeout(() => setFormFocused(isFormControl(document.activeElement)), 0);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return (
    <>
    <aside
      className={`floating-contact ${formFocused ? "is-form-focused" : ""}`}
      aria-label="Liên hệ nhanh"
    >
      <div className="ara-mascot-slot">
        <AriBunny
          interaction={interaction}
          message={message}
          onClick={()=>setChatOpen(true)}
        />
        {unread>0&&<span className="ara-chat-unread" aria-label={`${unread} tin chưa đọc`}>{unread>9?"9+":unread}</span>}
        <span className="ara-chat-online-dot" aria-hidden="true"/>
      </div>

      <ContactLink
        type="phone"
        href="tel:0364019798"
        label="Gọi hotline Ara"
      >
        <Phone size={18} />
      </ContactLink>

      <ContactLink
        type="instagram"
        href="https://www.instagram.com/ara.thuedosg?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
        label="Instagram Ara"
        external
      >
        <Instagram size={18} />
      </ContactLink>

      <ContactLink
        type="facebook"
        href="https://www.facebook.com/share/1L3WXUML8x/?mibextid=wwXIfr"
        label="Facebook Ara"
        external
      >
        <Facebook size={18} />
      </ContactLink>
    </aside>
    <AraChatWidget open={chatOpen} onOpenChange={setChatOpen} user={user} unread={unread} onUnreadChange={setUnread}/>
    </>
  );
}
