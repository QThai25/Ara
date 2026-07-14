import React, { useEffect, useRef, useState } from "react";
import "./LuxuryAraBunny.compact.css";

const MESSAGES = [
  "Ara ở đây nè ✨",
  "Mẫu mới xinh lắm đó!",
  "Để Ara chọn đồ cùng bạn nha 💛",
  "Nhấn vào Ara thử đi!",
  "Hôm nay mình mặc gì ta?"
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toCssLength(value, fallback) {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value || fallback;
}

export function LuxuryAraBunny({
  imageSrc = "/ara-luxury-bunny.png",
  className = "",
  size = 104,
  right = 16,
  bottom = 176
}) {
  const rootRef = useRef(null);
  const winkTimerRef = useRef(null);
  const messageTimerRef = useRef(null);
  const reactionTimerRef = useRef(null);
  const winkResetTimerRef = useRef(null);

  const [message, setMessage] = useState("Ara chào bạn ✨");
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [winking, setWinking] = useState(false);
  const [reacting, setReacting] = useState(false);

  const showMessage = (nextMessage, duration = 2400) => {
    window.clearTimeout(messageTimerRef.current);

    setMessage(nextMessage);
    setBubbleVisible(true);

    messageTimerRef.current = window.setTimeout(() => {
      setBubbleVisible(false);
    }, duration);
  };

  const wink = () => {
    window.clearTimeout(winkResetTimerRef.current);

    setWinking(false);

    window.requestAnimationFrame(() => {
      setWinking(true);

      winkResetTimerRef.current = window.setTimeout(() => {
        setWinking(false);
      }, 420);
    });
  };

  useEffect(() => {
    let cancelled = false;

    const scheduleWink = () => {
      window.clearTimeout(winkTimerRef.current);

      winkTimerRef.current = window.setTimeout(() => {
        if (cancelled) return;

        wink();
        scheduleWink();
      }, randomDelay(5200, 9000));
    };

    const messageInterval = window.setInterval(() => {
      if (!cancelled) {
        showMessage(randomItem(MESSAGES));
      }
    }, 15000);

    scheduleWink();

    return () => {
      cancelled = true;
      window.clearTimeout(winkTimerRef.current);
      window.clearTimeout(messageTimerRef.current);
      window.clearTimeout(reactionTimerRef.current);
      window.clearTimeout(winkResetTimerRef.current);
      window.clearInterval(messageInterval);
    };
  }, []);

  const handlePointerMove = (event) => {
    const element = rootRef.current;

    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    element.style.setProperty("--rotate-y", `${x * 4}deg`);
    element.style.setProperty("--rotate-x", `${y * -3}deg`);
  };

  const resetTilt = () => {
    const element = rootRef.current;

    if (!element) return;

    element.style.setProperty("--rotate-y", "0deg");
    element.style.setProperty("--rotate-x", "0deg");
  };

  const handleClick = () => {
    window.clearTimeout(reactionTimerRef.current);

    wink();
    setReacting(true);
    showMessage("Bắt được Ara rồi nè! ✨", 2200);

    reactionTimerRef.current = window.setTimeout(() => {
      setReacting(false);
    }, 620);
  };

  return (
    <button
      ref={rootRef}
      type="button"
      className={[
        "ara-luxury-bunny",
        winking ? "is-winking" : "",
        reacting ? "is-reacting" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--bunny-size": toCssLength(size, "104px"),
        "--bunny-right": toCssLength(right, "16px"),
        "--bunny-bottom": toCssLength(bottom, "176px")
      }}
      aria-label="Bé thỏ Ara"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onClick={handleClick}
    >
      <span
        className={[
          "ara-luxury-bunny__bubble",
          bubbleVisible ? "is-visible" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        role="status"
        aria-live="polite"
      >
        {message}
      </span>

      <span
        className="ara-luxury-bunny__spark ara-luxury-bunny__spark--1"
        aria-hidden="true"
      >
        ✦
      </span>

      <span
        className="ara-luxury-bunny__spark ara-luxury-bunny__spark--2"
        aria-hidden="true"
      >
        ✦
      </span>

      <span className="ara-luxury-bunny__stage">
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />

        <span
          className="ara-luxury-bunny__wink-cover"
          aria-hidden="true"
        />

        <span
          className="ara-luxury-bunny__wink-line"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}