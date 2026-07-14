import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";

const AriMascotContext = createContext({
  interaction: null,
  message: "",
  showProductReaction: () => {},
  celebrateProduct: () => {},
  showAriMessage: () => {},
  celebrateAri: () => {},
  clearReaction: () => {}
});

export function AriMascotProvider({ children }) {
  const [interaction, setInteraction] = useState(null);
  const hideTimerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showAriMessage = useCallback(({
    type = "message",
    message,
    effect = null,
    duration = 1800
  }) => {
    clearTimer();

    setInteraction({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      effect,
      message
    });

    if (duration > 0) {
      hideTimerRef.current = window.setTimeout(() => {
        setInteraction(null);
      }, duration);
    }
  }, [clearTimer]);

  const celebrateAri = useCallback((message) => {
    showAriMessage({
      type: "celebrate",
      effect: "sparkle",
      message,
      duration: 2100
    });
  }, [showAriMessage]);

  const showProductReaction = useCallback((product) => {
    const name = product?.name || product?.title || "";

    showAriMessage({
      type: "product",
      message: name
        ? `Chiếc ${name} này rất hợp với bạn đó!`
        : "Rất hợp với bạn đó!",
      duration: 0
    });
  }, [showAriMessage]);

  const celebrateProduct = useCallback((product) => {
    const name = product?.name || product?.title || "";

    celebrateAri(
      name
        ? `Ari mở ${name} cho bạn nha ✨`
        : "Ari mở thiết kế này cho bạn nha ✨"
    );
  }, [celebrateAri]);
  
  const clearReaction = useCallback(() => {
    clearTimer();

    hideTimerRef.current = window.setTimeout(() => {
      setInteraction(null);
    }, 200);
  }, [clearTimer]);

  const value = useMemo(() => ({
    interaction,
    message: interaction?.message || "",
    showProductReaction,
    celebrateProduct,
    showAriMessage,
    celebrateAri,
    clearReaction
  }), [
    interaction,
    showProductReaction,
    celebrateProduct,
    showAriMessage,
    celebrateAri,
    clearReaction
  ]);

  return (
    <AriMascotContext.Provider value={value}>
      {children}
    </AriMascotContext.Provider>
  );
}

export function useAriMascot() {
  return useContext(AriMascotContext);
}
