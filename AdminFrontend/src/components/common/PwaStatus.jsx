import React, { useEffect } from "react";
import { RefreshCcw, WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus.js";

const OFFLINE_MESSAGE = "Không có kết nối mạng. Vui lòng kết nối lại để tiếp tục thao tác.";

export function NetworkStatusBanner() {
  const online = useNetworkStatus();

  useEffect(() => {
    document.body.dataset.araNetwork = online ? "online" : "offline";

    const preventOfflineSubmit = (event) => {
      if (navigator.onLine === false) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("submit", preventOfflineSubmit, true);
    return () => {
      document.removeEventListener("submit", preventOfflineSubmit, true);
      delete document.body.dataset.araNetwork;
    };
  }, [online]);

  if (online) return null;
  return (
    <div className="ara-network-banner" role="status" aria-live="polite">
      <WifiOff size={17} aria-hidden="true" />
      <span>{OFFLINE_MESSAGE}</span>
    </div>
  );
}

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <aside className="ara-pwa-update" role="status" aria-live="polite">
      <div className="ara-pwa-update__copy">
        <RefreshCcw size={18} aria-hidden="true" />
        <div>
          <strong>ARA Admin có phiên bản mới</strong>
          <span>Cập nhật để sử dụng phiên bản mới nhất.</span>
        </div>
      </div>
      <div className="ara-pwa-update__actions">
        <button type="button" className="ara-pwa-update__confirm" onClick={() => updateServiceWorker(true)}>
          Cập nhật ngay
        </button>
        <button type="button" className="ara-pwa-update__dismiss" onClick={() => setNeedRefresh(false)}>
          Để sau
        </button>
        <button type="button" className="ara-pwa-update__close" aria-label="Đóng thông báo cập nhật" onClick={() => setNeedRefresh(false)}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
