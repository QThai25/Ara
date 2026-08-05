import { useEffect, useRef } from "react";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function useModalFocus(active, onClose) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector(FOCUSABLE);
      (first || dialogRef.current)?.focus();
    });
    const keyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keyDown);
      previous?.focus?.();
    };
  }, [active]);

  return dialogRef;
}
