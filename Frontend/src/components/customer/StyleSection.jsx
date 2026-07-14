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

import { styles } from "../../utils/catalogData.js";
import { IconCard } from "../common/IconCard.jsx";

export function StyleSection() {
  const [searchParams] = useSearchParams();
  const activeStyle = searchParams.get("style");

  const trackRef = useRef(null);

  const [canGoPrevious, setCanGoPrevious] =
    useState(false);
  const [canGoNext, setCanGoNext] =
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

    const handleResize = () => {
      updateNavigation();
    };

    track.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      track.removeEventListener(
        "scroll",
        handleScroll
      );

      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [updateNavigation]);

  const scrollTrack = (direction) => {
    const track = trackRef.current;

    if (!track) return;

    const distance =
      Math.max(
        track.clientWidth * 0.72,
        260
      ) * direction;

    track.scrollBy({
      left: distance,
      behavior: "smooth"
    });
  };

  return (
    <section className="mei-icon-section mei-style-section">
      <div className="style-section-heading">
        <div>


          <div className="style-section-title-row">
            <h2>Phong cách của bạn</h2>
            <span />
          </div>
        </div>

        <div className="style-section-navigation">
          <button
            type="button"
            aria-label="Xem phong cách trước"
            onClick={() => scrollTrack(-1)}
            disabled={!canGoPrevious}
          >
            <ChevronLeft
              size={20}
              strokeWidth={1.6}
            />
          </button>

          <button
            type="button"
            aria-label="Xem phong cách tiếp theo"
            onClick={() => scrollTrack(1)}
            disabled={!canGoNext}
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
        className="style-carousel-track"
        aria-label="Danh sách phong cách"
      >
        {styles.map((item) => (
          <div
            className="style-carousel-item"
            key={item.slug}
          >
            <IconCard
              icon={item.icon}
              label={item.label}
              to={`/costumes?style=${item.slug}`}
              active={activeStyle === item.slug}
              ariaLabel={`Xem phong cách ${item.label}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}