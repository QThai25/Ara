import { useEffect, useState } from "react";

function readOnlineState() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useNetworkStatus() {
  const [online, setOnline] = useState(readOnlineState);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
