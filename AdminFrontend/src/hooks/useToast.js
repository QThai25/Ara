import { useState } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const notify = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 2800);
  };

  return { toast, notify };
}
