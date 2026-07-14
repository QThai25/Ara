import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from "react";

import "./ariBunny.css";

const CONTACT_MESSAGES = {
  phone: {
    focus: "Gọi cho ARA nha 📞",
    reaction: "ARA nghe máy liền nè!"
  },
  instagram: {
    focus: "Xem váy mới cùng Ari nha ✨",
    reaction: "Ari mở Instagram rồi nè!"
  },
  facebook: {
    focus: "Nhắn ARA trên Facebook nha 💌",
    reaction: "ARA đang chờ tin nhắn đó!"
  }
};

const MASCOT_MESSAGES = [
  "Ari thấy bạn rồi nè 👀",
  "Cần Ari tư vấn váy không?",
  "Lại gần Ari một chút nha ✨",
  "Hôm nay bạn muốn thuê váy gì?",
  "Bộ này chắc chắn hợp với bạn đó 🤎"
];

const CLICK_REACTIONS = [
  {
    message: "Ari chớp mắt với bạn nè ✨",
    mood: "happy",
    sparkle: true,
    action: "hello"
  },
  {
    message: "Bạn dễ thương quá đó 🤎",
    mood: "shy",
    sparkle: true,
    action: "blush"
  },
  {
    message: "Ari sẵn sàng tư vấn cho bạn!",
    mood: "excited",
    sparkle: true,
    action: "dance"
  },
  {
    message: "Ari nghiêng đầu nghe bạn nè 👀",
    mood: "curious",
    sparkle: false,
    action: "peek"
  }
];

const IDLE_ACTIONS = [
  "ear-twitch",
  "peek",
  "sleepy",
  "hello"
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomMessage() {
  return MASCOT_MESSAGES[
    Math.floor(Math.random() * MASCOT_MESSAGES.length)
  ];
}

function AriEye({
  side,
  x,
  eyeGradientId,
  eyeHighlightId
}) {
  return (
    <g
      className={`ari-bunny-eye-position ari-bunny-eye-position--${side}`}
      transform={`translate(${x} 56)`}
    >
      <g
        className={`ari-bunny-eye ari-bunny-eye--${side}`}
      >
        <ellipse
          cx="0"
          cy="0"
          rx="10.4"
          ry="13.6"
          fill="#FFFEFA"
          stroke="#B68D61"
          strokeWidth="1"
          strokeOpacity="0.52"
        />

        <g className="ari-bunny-iris">
          <ellipse
            cx="0"
            cy="1"
            rx="7.4"
            ry="10.4"
            fill={`url(#${eyeGradientId})`}
          />

          <ellipse
            cx="0"
            cy="2"
            rx="4.3"
            ry="7.5"
            fill="#34251F"
          />

          <ellipse
            cx="0"
            cy="2.5"
            rx="2.5"
            ry="5.2"
            fill="#160E0A"
          />

          <ellipse
            cx="-2.8"
            cy="-3.8"
            rx="3.1"
            ry="4"
            fill={`url(#${eyeHighlightId})`}
          />

          <circle
            cx="3.5"
            cy="-2.8"
            r="1.65"
            fill="#FFFFFF"
          />

          <circle
            cx="-1.8"
            cy="6.3"
            r="0.9"
            fill="#FFF9F1"
            opacity="0.58"
          />
        </g>

        <path
          d="M -9 -4 C -6 -13 5 -14 10 -4"
          fill="none"
          stroke="#51372D"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        <path
          d={
            side === "left"
              ? `
                M -7 -8 L -10 -11
                M -3 -11 L -4 -14
              `
              : `
                M 7 -8 L 10 -11
                M 3 -11 L 4 -14
              `
          }
          fill="none"
          stroke="#51372D"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>
    </g>
  );
}

export function AriBunny({
  size = 62,
  className = "",
  interactive = true,
  message,
  interaction,
  onClick,
  trackPointer = true,
  winkOnPageClick = true
}) {
  const rootRef = useRef(null);
  const pointerFrameRef = useRef(null);
  const hideMessageTimerRef = useRef(null);
  const bounceTimerRef = useRef(null);
  const winkTimerRef = useRef(null);
  const sparkleTimerRef = useRef(null);
  const eyeBurstTimerRef = useRef(null);
  const moodTimerRef = useRef(null);
  const hoverWinkTimerRef = useRef(null);
  const actionTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const heartTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const clickReactionRef = useRef(0);
  const lastInteractionIdRef = useRef(null);
  const nextWinkRef = useRef("left");

  const rawId = useId();
  const uniqueId = rawId.replace(/:/g, "");

  const furGradientId = `ari-bunny-fur-${uniqueId}`;
  const faceGradientId = `ari-bunny-face-${uniqueId}`;
  const earGradientId = `ari-bunny-ear-${uniqueId}`;
  const eyeGradientId = `ari-bunny-eye-${uniqueId}`;
  const eyeHighlightId = `ari-bunny-eye-highlight-${uniqueId}`;
  const bowGradientId = `ari-bunny-bow-${uniqueId}`;
  const noseGradientId = `ari-bunny-nose-${uniqueId}`;
  const shadowFilterId = `ari-bunny-shadow-${uniqueId}`;

  const [internalMessage, setInternalMessage] = useState("");
  const [winkSide, setWinkSide] = useState(null);
  const [eyeBurstSide, setEyeBurstSide] = useState(null);
  const [bouncing, setBouncing] = useState(false);
  const [sparkling, setSparkling] = useState(false);
  const [showingHearts, setShowingHearts] = useState(false);
  const [action, setAction] = useState(null);
  const [mood, setMood] = useState("idle");
  const [pressed, setPressed] = useState(false);

  const resolvedMessage =
    typeof message === "string"
      ? message
      : internalMessage;
  const isProductReaction =
    interaction?.type === "product";
  const isCelebrating =
    interaction?.effect === "sparkle";

  const resolvedSize =
    typeof size === "number"
      ? `${size}px`
      : size;

  const clearHideTimer = useCallback(() => {
    if (hideMessageTimerRef.current) {
      window.clearTimeout(hideMessageTimerRef.current);
      hideMessageTimerRef.current = null;
    }
  }, []);

  const hideMessageLater = useCallback(
    (delay = 180) => {
      if (typeof message === "string") {
        return;
      }

      clearHideTimer();

      hideMessageTimerRef.current = window.setTimeout(() => {
        setInternalMessage("");
      }, delay);
    },
    [clearHideTimer, message]
  );

  const showTemporaryMessage = useCallback(
    (text, duration = 1700) => {
      if (typeof message === "string") {
        return;
      }

      clearHideTimer();
      setInternalMessage(text);

      hideMessageTimerRef.current = window.setTimeout(() => {
        setInternalMessage("");
      }, duration);
    },
    [clearHideTimer, message]
  );

  const triggerEyeBurst = useCallback((side) => {
    if (eyeBurstTimerRef.current) {
      window.clearTimeout(eyeBurstTimerRef.current);
    }

    setEyeBurstSide(null);

    window.requestAnimationFrame(() => {
      setEyeBurstSide(side);
    });

    eyeBurstTimerRef.current = window.setTimeout(() => {
      setEyeBurstSide(null);
    }, 1050);
  }, []);

  const triggerWink = useCallback(
    (preferredSide) => {
      if (winkTimerRef.current) {
        window.clearTimeout(winkTimerRef.current);
      }

      const side = preferredSide || nextWinkRef.current;

      setWinkSide(null);

      window.requestAnimationFrame(() => {
        setWinkSide(side);
        triggerEyeBurst(side);
      });

      nextWinkRef.current =
        side === "left" ? "right" : "left";

      winkTimerRef.current = window.setTimeout(() => {
        setWinkSide(null);
      }, 560);
    },
    [triggerEyeBurst]
  );

  const triggerBounce = useCallback(() => {
    if (bounceTimerRef.current) {
      window.clearTimeout(bounceTimerRef.current);
    }

    setBouncing(false);

    window.requestAnimationFrame(() => {
      setBouncing(true);
    });

    bounceTimerRef.current = window.setTimeout(() => {
      setBouncing(false);
    }, 620);
  }, []);

  const triggerSparkle = useCallback(() => {
    if (sparkleTimerRef.current) {
      window.clearTimeout(sparkleTimerRef.current);
    }

    setSparkling(false);

    window.requestAnimationFrame(() => {
      setSparkling(true);
    });

    sparkleTimerRef.current = window.setTimeout(() => {
      setSparkling(false);
    }, 920);
  }, []);

  const triggerMood = useCallback((nextMood, duration = 900) => {
    if (moodTimerRef.current) {
      window.clearTimeout(moodTimerRef.current);
    }

    setMood(nextMood);

    if (nextMood === "idle") {
      return;
    }

    moodTimerRef.current = window.setTimeout(() => {
      setMood("idle");
    }, duration);
  }, []);

  const triggerAction = useCallback((nextAction, duration = 1000) => {
    if (actionTimerRef.current) {
      window.clearTimeout(actionTimerRef.current);
    }

    setAction(null);

    window.requestAnimationFrame(() => {
      setAction(nextAction);
    });

    actionTimerRef.current = window.setTimeout(() => {
      setAction(null);
    }, duration);
  }, []);

  const triggerHearts = useCallback(() => {
    if (heartTimerRef.current) {
      window.clearTimeout(heartTimerRef.current);
    }

    setShowingHearts(false);

    window.requestAnimationFrame(() => {
      setShowingHearts(true);
    });

    heartTimerRef.current = window.setTimeout(() => {
      setShowingHearts(false);
    }, 1400);
  }, []);

  useEffect(() => {
    if (!interactive) {
      return undefined;
    }

    const scheduleIdleAction = () => {
      const delay = 5200 + Math.random() * 4200;

      idleTimerRef.current = window.setTimeout(() => {
        if (document.hidden || rootRef.current?.matches(":hover, :focus-visible")) {
          scheduleIdleAction();
          return;
        }

        const nextAction =
          IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)];

        if (nextAction === "sleepy") {
          triggerAction("sleepy", 1550);
          triggerMood("sleepy", 1550);
        } else if (nextAction === "peek") {
          triggerAction("peek", 1200);
          triggerMood("curious", 1200);
        } else if (nextAction === "hello") {
          triggerAction("hello", 1150);
          triggerBounce();
        } else {
          triggerAction("ear-twitch", 950);
        }

        if (Math.random() > 0.45) {
          triggerWink();
        }

        scheduleIdleAction();
      }, delay);
    };

    scheduleIdleAction();

    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [
    interactive,
    triggerAction,
    triggerBounce,
    triggerMood,
    triggerWink
  ]);

  useEffect(() => {
    if (!interaction?.id || lastInteractionIdRef.current === interaction.id) {
      return;
    }

    lastInteractionIdRef.current = interaction.id;

    if (interaction.effect === "sparkle") {
      triggerWink();
      triggerBounce();
      triggerSparkle();
      triggerMood("excited", 1100);
    }
  }, [
    interaction?.id,
    interaction?.effect,
    triggerBounce,
    triggerMood,
    triggerSparkle,
    triggerWink
  ]);

  useEffect(() => {
    const handleContactFocus = (event) => {
      const target = event.detail?.target;

      if (!target) {
        hideMessageLater();
        return;
      }

      const contact = CONTACT_MESSAGES[target];

      if (!contact) {
        return;
      }

      clearHideTimer();
      setInternalMessage(contact.focus);
    };

    const handleContactReaction = (event) => {
      const type = event.detail?.type;
      const contact = CONTACT_MESSAGES[type];

      if (!contact) {
        return;
      }

      triggerWink();
      triggerBounce();
      triggerSparkle();
      triggerAction("hello", 1000);
      triggerMood("happy", 1000);
      showTemporaryMessage(contact.reaction);
    };

    window.addEventListener(
      "ara-mascot-contact-focus",
      handleContactFocus
    );

    window.addEventListener(
      "ara-mascot-contact-reaction",
      handleContactReaction
    );

    return () => {
      window.removeEventListener(
        "ara-mascot-contact-focus",
        handleContactFocus
      );

      window.removeEventListener(
        "ara-mascot-contact-reaction",
        handleContactReaction
      );
    };
  }, [
    clearHideTimer,
    hideMessageLater,
    showTemporaryMessage,
    triggerAction,
    triggerBounce,
    triggerMood,
    triggerSparkle,
    triggerWink
  ]);

  useEffect(() => {
    if (!trackPointer) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      if (pointerFrameRef.current) {
        window.cancelAnimationFrame(pointerFrameRef.current);
      }

      pointerFrameRef.current =
        window.requestAnimationFrame(() => {
          const root = rootRef.current;

          if (!root) {
            return;
          }

          const rect = root.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height * 0.48;

          const normalizedX = clamp(
            (event.clientX - centerX) / 280,
            -1,
            1
          );

          const normalizedY = clamp(
            (event.clientY - centerY) / 240,
            -1,
            1
          );

          root.style.setProperty(
            "--ari-bunny-look-x",
            `${normalizedX * 2.8}px`
          );

          root.style.setProperty(
            "--ari-bunny-look-y",
            `${normalizedY * 2.1}px`
          );

          root.style.setProperty(
            "--ari-bunny-head-rotate",
            `${normalizedX * 1.1}deg`
          );
        });
    };

    document.addEventListener(
      "pointermove",
      handlePointerMove,
      { passive: true }
    );

    return () => {
      document.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      if (pointerFrameRef.current) {
        window.cancelAnimationFrame(
          pointerFrameRef.current
        );
      }
    };
  }, [trackPointer]);

  useEffect(() => {
    if (!winkOnPageClick) {
      return undefined;
    }

    const handlePageClick = (event) => {
      if (rootRef.current?.contains(event.target)) {
        return;
      }

      triggerWink();
      triggerMood("curious", 650);
    };

    document.addEventListener(
      "click",
      handlePageClick,
      true
    );

    return () => {
      document.removeEventListener(
        "click",
        handlePageClick,
        true
      );
    };
  }, [triggerMood, triggerWink, winkOnPageClick]);

  useEffect(() => {
    return () => {
      if (pointerFrameRef.current) {
        window.cancelAnimationFrame(
          pointerFrameRef.current
        );
      }

      if (hideMessageTimerRef.current) {
        window.clearTimeout(
          hideMessageTimerRef.current
        );
      }

      if (bounceTimerRef.current) {
        window.clearTimeout(
          bounceTimerRef.current
        );
      }

      if (winkTimerRef.current) {
        window.clearTimeout(
          winkTimerRef.current
        );
      }

      if (sparkleTimerRef.current) {
        window.clearTimeout(
          sparkleTimerRef.current
        );
      }

      if (eyeBurstTimerRef.current) {
        window.clearTimeout(
          eyeBurstTimerRef.current
        );
      }

      if (moodTimerRef.current) {
        window.clearTimeout(
          moodTimerRef.current
        );
      }

      if (hoverWinkTimerRef.current) {
        window.clearTimeout(
          hoverWinkTimerRef.current
        );
      }

      if (actionTimerRef.current) {
        window.clearTimeout(actionTimerRef.current);
      }

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }

      if (heartTimerRef.current) {
        window.clearTimeout(heartTimerRef.current);
      }

      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handlePointerEnter = () => {
    if (!interactive) {
      return;
    }

    clearHideTimer();
    triggerAction("peek", 1500);
    triggerMood("curious", 1500);

    if (typeof message !== "string") {
      setInternalMessage(randomMessage());
    }

    if (hoverWinkTimerRef.current) {
      window.clearTimeout(hoverWinkTimerRef.current);
    }

    hoverWinkTimerRef.current = window.setTimeout(() => {
      triggerWink();
    }, 360);
  };

  const handlePointerLeave = () => {
    if (hoverWinkTimerRef.current) {
      window.clearTimeout(hoverWinkTimerRef.current);
      hoverWinkTimerRef.current = null;
    }

    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    setPressed(false);
    setAction(null);
    setMood("idle");
    hideMessageLater();
  };

  const runPrimaryReaction = () => {
    const reaction =
      CLICK_REACTIONS[
        clickReactionRef.current % CLICK_REACTIONS.length
      ];

    clickReactionRef.current += 1;

    triggerWink();
    triggerBounce();
    triggerAction(reaction.action, 1150);
    triggerMood(reaction.mood, 1100);
    showTemporaryMessage(reaction.message, 1900);

    if (reaction.sparkle) {
      triggerSparkle();
    }
  };

  const handleClick = (event) => {
    if (!interactive) {
      return;
    }

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    runPrimaryReaction();

    if (typeof onClick === "function") {
      onClick(event);
    }
  };

  const handleDoubleClick = () => {
    if (!interactive) {
      return;
    }

    triggerWink("right");
    triggerBounce();
    triggerSparkle();
    triggerHearts();
    triggerAction("dance", 1450);
    triggerMood("excited", 1400);
    showTemporaryMessage(
      "Ari tung sao chào bạn nè ✨✨",
      2100
    );
  };

  const handleFocus = () => {
    if (!interactive) {
      return;
    }

    triggerAction("peek", 1200);
    triggerMood("curious", 1200);

    if (typeof message !== "string") {
      clearHideTimer();
      setInternalMessage("Ari đang lắng nghe bạn nè 🤎");
    }
  };

  const handleBlur = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    setPressed(false);
    setAction(null);
    setMood("idle");
    hideMessageLater(120);
  };

  const handlePointerDown = () => {
    if (!interactive) {
      return;
    }

    setPressed(true);
    longPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setPressed(false);
      triggerHearts();
      triggerSparkle();
      triggerAction("hug", 1450);
      triggerMood("shy", 1450);
      showTemporaryMessage("Ari ôm bạn một cái nè 🤎", 2100);
    }, 650);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    setPressed(false);
  };

  const handleKeyDown = (event) => {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    event.preventDefault();
    runPrimaryReaction();

    if (typeof onClick === "function") {
      onClick(event);
    }
  };

  const rootClassName = [
    "ari-bunny-root",
    interactive ? "ari-bunny-interactive" : "",
    isProductReaction ? "ari-bunny-product-reacting" : "",
    isCelebrating ? "ari-bunny-celebrating" : "",
    sparkling ? "ari-bunny-sparkling" : "",
    bouncing ? "ari-bunny-bouncing" : "",
    pressed ? "ari-bunny-pressed" : "",
    action ? `ari-bunny-action-${action}` : "",
    mood !== "idle" ? `ari-bunny-mood-${mood}` : "",
    winkSide === "left"
      ? "ari-bunny-wink-left"
      : "",
    winkSide === "right"
      ? "ari-bunny-wink-right"
      : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const RootElement = interactive ? "button" : "div";

  return (
    <RootElement
      ref={rootRef}
      className={rootClassName}
      style={{
        width: resolvedSize,
        height: resolvedSize
      }}
      type={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive
          ? "Ari Bunny, nhấn hoặc giữ để tương tác"
          : undefined
      }
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={interactive ? handleClick : undefined}
      onDoubleClick={
        interactive ? handleDoubleClick : undefined
      }
      onKeyDown={
        interactive ? handleKeyDown : undefined
      }
    >
      {resolvedMessage ? (
        <span
          className="ari-bunny-message"
          role="status"
          aria-live="polite"
        >
          {resolvedMessage}
        </span>
      ) : null}

      {sparkling ? (
        <span className="ari-bunny-sparkles" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : null}

      {showingHearts ? (
        <span className="ari-bunny-hearts" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : null}


      <svg
        className="ari-bunny-svg"
        viewBox="0 0 120 120"
        width="100%"
        height="100%"
        role="img"
        aria-label="Ari Bunny"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient
            id={furGradientId}
            cx="38%"
            cy="25%"
            r="82%"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#FFF9F1" />
            <stop offset="82%" stopColor="#F5E9DB" />
            <stop offset="100%" stopColor="#E8D3BE" />
          </radialGradient>

          <radialGradient
            id={faceGradientId}
            cx="50%"
            cy="34%"
            r="67%"
          >
            <stop
              offset="0%"
              stopColor="#FFFFFF"
              stopOpacity="0.92"
            />

            <stop
              offset="70%"
              stopColor="#FFF9F1"
              stopOpacity="0.2"
            />

            <stop
              offset="100%"
              stopColor="#D8B7A3"
              stopOpacity="0.14"
            />
          </radialGradient>

          <linearGradient
            id={earGradientId}
            x1="20%"
            y1="0%"
            x2="75%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#FBECE7" />
            <stop offset="50%" stopColor="#EBC5B9" />
            <stop offset="100%" stopColor="#D9A99E" />
          </linearGradient>

          <radialGradient
            id={eyeGradientId}
            cx="35%"
            cy="24%"
            r="78%"
          >
            <stop offset="0%" stopColor="#E4C88D" />
            <stop offset="35%" stopColor="#976B3D" />
            <stop offset="72%" stopColor="#53372A" />
            <stop offset="100%" stopColor="#20130F" />
          </radialGradient>

          <radialGradient
            id={eyeHighlightId}
            cx="30%"
            cy="25%"
            r="72%"
          >
            <stop offset="0%" stopColor="#FFFFFF" />

            <stop
              offset="70%"
              stopColor="#FFF9F1"
              stopOpacity="0.85"
            />

            <stop
              offset="100%"
              stopColor="#FFF9F1"
              stopOpacity="0"
            />
          </radialGradient>

          <linearGradient
            id={bowGradientId}
            x1="10%"
            y1="0%"
            x2="90%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#EED99F" />
            <stop offset="42%" stopColor="#C8A96A" />
            <stop offset="75%" stopColor="#A98148" />
            <stop offset="100%" stopColor="#DEC286" />
          </linearGradient>

          <linearGradient
            id={noseGradientId}
            x1="20%"
            y1="0%"
            x2="80%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#F2C6BC" />
            <stop offset="55%" stopColor="#DEA297" />
            <stop offset="100%" stopColor="#BD7E77" />
          </linearGradient>

          <filter
            id={shadowFilterId}
            x="-35%"
            y="-35%"
            width="170%"
            height="175%"
          >
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2.4"
              floodColor="#34251F"
              floodOpacity="0.16"
            />
          </filter>
        </defs>

        <g
          className="ari-bunny-character"
          filter={`url(#${shadowFilterId})`}
        >
          <g className="ari-bunny-head-tracker">
            <g className="ari-bunny-ears">
              <path
                className="ari-bunny-ear ari-bunny-ear--left"
                d="
                  M 38 28
                  C 28 18 16 23 11 38
                  C 5 55 8 78 17 90
                  C 24 99 32 94 35 82
                  C 39 68 34 51 42 35
                  C 44 31 42 29 38 28
                  Z
                "
                fill={`url(#${furGradientId})`}
                stroke="#C8A96A"
                strokeWidth="0.9"
                strokeOpacity="0.48"
              />

              <path
                className="ari-bunny-ear-inner ari-bunny-ear-inner--left"
                d="
                  M 32 32
                  C 24 28 18 38 17 51
                  C 15 65 18 79 23 84
                  C 27 88 30 80 31 71
                  C 33 57 29 45 36 35
                  C 37 33 35 32 32 32
                  Z
                "
                fill={`url(#${earGradientId})`}
                opacity="0.77"
              />

              <path
                className="ari-bunny-ear ari-bunny-ear--right"
                d="
                  M 82 28
                  C 92 18 104 23 109 38
                  C 115 55 112 78 103 90
                  C 96 99 88 94 85 82
                  C 81 68 86 51 78 35
                  C 76 31 78 29 82 28
                  Z
                "
                fill={`url(#${furGradientId})`}
                stroke="#C8A96A"
                strokeWidth="0.9"
                strokeOpacity="0.48"
              />

              <path
                className="ari-bunny-ear-inner ari-bunny-ear-inner--right"
                d="
                  M 88 32
                  C 96 28 102 38 103 51
                  C 105 65 102 79 97 84
                  C 93 88 90 80 89 71
                  C 87 57 91 45 84 35
                  C 83 33 85 32 88 32
                  Z
                "
                fill={`url(#${earGradientId})`}
                opacity="0.77"
              />
            </g>

            <g className="ari-bunny-head">
              <path
                d="
                  M 60 14
                  C 34 14 17 32 17 58
                  C 17 84 35 103 60 103
                  C 85 103 103 84 103 58
                  C 103 32 86 14 60 14
                  Z
                "
                fill={`url(#${furGradientId})`}
                stroke="#B98E5C"
                strokeWidth="1"
                strokeOpacity="0.52"
              />

              <path
                d="
                  M 60 22
                  C 39 22 25 37 25 59
                  C 25 81 40 96 60 96
                  C 80 96 95 81 95 59
                  C 95 37 81 22 60 22
                  Z
                "
                fill={`url(#${faceGradientId})`}
              />

              <path
                d="
                  M 50 20
                  C 52 13 57 10 61 9
                  C 58 13 59 17 63 20
                "
                fill="#FFF9F1"
                stroke="#C8A96A"
                strokeWidth="0.7"
                strokeLinecap="round"
                strokeOpacity="0.5"
              />

              <path
                d="
                  M 59 19
                  C 62 12 67 11 71 13
                  C 67 15 66 18 69 22
                "
                fill="#FFF9F1"
                stroke="#C8A96A"
                strokeWidth="0.65"
                strokeLinecap="round"
                strokeOpacity="0.46"
              />

              <ellipse
                className="ari-bunny-cheek ari-bunny-cheek--left"
                cx="36"
                cy="72"
                rx="10"
                ry="6.3"
                fill="#D8B7A3"
                opacity="0.2"
              />

              <ellipse
                className="ari-bunny-cheek ari-bunny-cheek--right"
                cx="84"
                cy="72"
                rx="10"
                ry="6.3"
                fill="#D8B7A3"
                opacity="0.2"
              />
            </g>

            <g className="ari-bunny-face">
              <path
                d="M 34 39 C 39 36 45 36 49 39"
                fill="none"
                stroke="#A97D5B"
                strokeWidth="0.9"
                strokeLinecap="round"
                opacity="0.58"
              />

              <path
                d="M 71 39 C 75 36 81 36 86 39"
                fill="none"
                stroke="#A97D5B"
                strokeWidth="0.9"
                strokeLinecap="round"
                opacity="0.58"
              />

              <g className="ari-bunny-eyes">
                <AriEye
                  side="left"
                  x={42}
                  eyeGradientId={eyeGradientId}
                  eyeHighlightId={eyeHighlightId}
                />

                <AriEye
                  side="right"
                  x={78}
                  eyeGradientId={eyeGradientId}
                  eyeHighlightId={eyeHighlightId}
                />
              </g>

              <g className="ari-bunny-mouth">
                <path
                  d="
                    M 60 69
                    C 57 65 52 66 53 70
                    C 54 73 57 75 60 77
                    C 63 75 66 73 67 70
                    C 68 66 63 65 60 69
                    Z
                  "
                  fill={`url(#${noseGradientId})`}
                  stroke="#B87972"
                  strokeWidth="0.5"
                />

                <path
                  d="M 60 76 L 60 81"
                  fill="none"
                  stroke="#704C41"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />

                <path
                  d="
                    M 60 81
                    C 56 85 52 85 49 82
                    M 60 81
                    C 64 85 68 85 71 82
                  "
                  fill="none"
                  stroke="#704C41"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />

                <path
                  d="M 55 88 C 58 90 62 90 65 88"
                  fill="none"
                  stroke="#CF9187"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  opacity="0.55"
                />
              </g>

              <g className="ari-bunny-whiskers">
                <path
                  d="M 51 77 C 42 75 34 76 28 79"
                  fill="none"
                  stroke="#99715A"
                  strokeWidth="0.55"
                  strokeLinecap="round"
                  opacity="0.45"
                />

                <path
                  d="M 51 81 C 42 81 35 84 30 87"
                  fill="none"
                  stroke="#99715A"
                  strokeWidth="0.55"
                  strokeLinecap="round"
                  opacity="0.4"
                />

                <path
                  d="M 69 77 C 78 75 86 76 92 79"
                  fill="none"
                  stroke="#99715A"
                  strokeWidth="0.55"
                  strokeLinecap="round"
                  opacity="0.45"
                />

                <path
                  d="M 69 81 C 78 81 85 84 90 87"
                  fill="none"
                  stroke="#99715A"
                  strokeWidth="0.55"
                  strokeLinecap="round"
                  opacity="0.4"
                />
              </g>
            </g>
          </g>

          <g className="ari-bunny-bow">
            <path
              d="
                M 52 94
                C 43 88 34 90 31 96
                C 28 103 35 109 44 109
                C 50 109 54 104 57 100
                Z
              "
              fill={`url(#${bowGradientId})`}
              stroke="#896438"
              strokeWidth="0.7"
              strokeOpacity="0.58"
            />

            <path
              d="
                M 68 94
                C 77 88 86 90 89 96
                C 92 103 85 109 76 109
                C 70 109 66 104 63 100
                Z
              "
              fill={`url(#${bowGradientId})`}
              stroke="#896438"
              strokeWidth="0.7"
              strokeOpacity="0.58"
            />

            <circle
              cx="60"
              cy="98"
              r="7"
              fill={`url(#${bowGradientId})`}
              stroke="#896438"
              strokeWidth="0.7"
              strokeOpacity="0.65"
            />

            <path
              d="M 60 105 L 60 108"
              fill="none"
              stroke="#8D6738"
              strokeWidth="0.8"
            />

            <circle
              cx="60"
              cy="112"
              r="4.4"
              fill="#FFF9F1"
              stroke="#C8A96A"
              strokeWidth="1.1"
            />

            <text
              x="60"
              y="114"
              textAnchor="middle"
              fontFamily="Georgia, serif"
              fontSize="5.4"
              fontWeight="700"
              fill="#8D6738"
            >
              A
            </text>
          </g>
        </g>
      </svg>
    </RootElement>
  );
}

export default AriBunny;