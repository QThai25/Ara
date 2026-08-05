import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  return { toast, notify };
}
