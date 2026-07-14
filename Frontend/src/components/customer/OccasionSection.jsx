import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { occasions } from "../../utils/catalogData.js";
import { IconCard } from "../common/IconCard.jsx";

export function OccasionSection() {
  const [searchParams] = useSearchParams();
  const activeOccasion =
    searchParams.get("occasion");

  const trackRef = useRef(null);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const preventClickRef = useRef(false);

  const [canGoPrevious, setCanGoPrevious] =
    useState(false);

  const [canGoNext, setCanGoNext] =
    useState(false);

  const [isDragging, setIsDragging] =
    useState(false);

  const updateNavigation = useCallback(() => {
    const track = trackRef.current;

    if (!track) return;

    const maxScroll =
      track.scrollWidth - track.clientWidth;

    setCanGoPrevious(track.scrollLeft > 4);

    setCanGoNext(
      track.scrollLeft < maxScroll - 4
    );
  }, []);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) return undefined;

    updateNavigation();

    const handleScroll = () => {
      window.requestAnimationFrame(
        updateNavigation
      );
    };

    const observer = new ResizeObserver(
      updateNavigation
    );

    track.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    observer.observe(track);

    return () => {
      track.removeEventListener(
        "scroll",
        handleScroll
      );

      observer.disconnect();
    };
  }, [updateNavigation]);

  const scrollTrack = (direction) => {
    const track = trackRef.current;

    if (!track) return;

    const distance = Math.max(
      track.clientWidth * 0.72,
      280
    );

    track.scrollBy({
      left: direction * distance,
      behavior: "smooth"
    });
  };

  const handlePointerDown = (event) => {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    const track = trackRef.current;

    if (!track) return;

    draggingRef.current = true;
    movedRef.current = false;

    startXRef.current = event.clientX;
    startScrollLeftRef.current =
      track.scrollLeft;

    setIsDragging(true);

    track.setPointerCapture?.(
      event.pointerId
    );
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;

    const track = trackRef.current;

    if (!track) return;

    const distance =
      event.clientX - startXRef.current;

    if (Math.abs(distance) > 6) {
      movedRef.current = true;
    }

    track.scrollLeft =
      startScrollLeftRef.current - distance;
  };

  const finishDragging = (event) => {
    const track = trackRef.current;

    if (!track || !draggingRef.current) {
      return;
    }

    draggingRef.current = false;
    preventClickRef.current =
      movedRef.current;

    setIsDragging(false);

    track.releasePointerCapture?.(
      event.pointerId
    );

    window.setTimeout(() => {
      preventClickRef.current = false;
    }, 0);
  };

  const handleClickCapture = (event) => {
    if (!preventClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <section className="mei-icon-section ara-occasion-section">
      <div className="ara-occasion-heading">
        <div>

          <div className="ara-occasion-title-row">
            <h2>Set đồ dành cho bạn</h2>
            <span />
          </div>
        </div>

        <div className="ara-occasion-navigation">
          <button
            type="button"
            aria-label="Xem dịp trước"
            disabled={!canGoPrevious}
            onClick={() => scrollTrack(-1)}
          >
            <ChevronLeft
              size={20}
              strokeWidth={1.6}
            />
          </button>

          <button
            type="button"
            aria-label="Xem dịp tiếp theo"
            disabled={!canGoNext}
            onClick={() => scrollTrack(1)}
          >
            <ChevronRight
              size={20}
              strokeWidth={1.6}
            />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className={`ara-occasion-track ${
          isDragging ? "is-dragging" : ""
        }`}
        aria-label="Danh sách dịp mặc"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
        onClickCapture={handleClickCapture}
      >
        {occasions.map((item) => (
          <div
            className="ara-occasion-item"
            key={item.slug}
          >
            <IconCard
              icon={item.icon}
              label={item.label}
              to={`/costumes?occasion=${item.slug}`}
              active={
                activeOccasion === item.slug
              }
              ariaLabel={`Xem trang phục cho ${item.label}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}