import { useState } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const notify = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };
  return { toast, notify };
}
