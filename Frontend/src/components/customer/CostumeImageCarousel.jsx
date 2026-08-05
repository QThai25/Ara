import {
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  normalizeImageList,
  resolveImageUrl
} from "../../utils/format.js";

const DRAG_THRESHOLD = 8;
const CHANGE_THRESHOLD = 45;

export function CostumeImageCarousel({
  images,
  image,
  name = "Trang phục",
  onOpen,
  className = "",
  variant = "card",
  showArrows = true,
  showCounter = true,
  showDots = false,
  index: controlledIndex,
  onIndexChange
}) {
  const safeList = useMemo(() => {
    const list = normalizeImageList(images, image, 10);

    return list.length
      ? list
      : ["/placeholder.png"];
  }, [images, image]);

  const isControlled =
    Number.isInteger(controlledIndex) &&
    typeof onIndexChange === "function";

  const [internalIndex, setInternalIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);

  const rootRef = useRef(null);
  const startXRef = useRef(0);
  const pointerIdRef = useRef(null);
  const draggedRef = useRef(false);

  const requestedIndex = isControlled
    ? controlledIndex
    : internalIndex;

  const activeIndex = Math.max(
    0,
    Math.min(requestedIndex, safeList.length - 1)
  );

  const hasMultipleImages = safeList.length > 1;

  const setIndex = (nextIndex) => {
    if (!safeList.length) return;

    const normalizedIndex =
      ((nextIndex % safeList.length) + safeList.length) %
      safeList.length;

    if (isControlled) {
      onIndexChange(normalizedIndex);
    } else {
      setInternalIndex(normalizedIndex);
    }
  };

  useEffect(() => {
    if (
      !isControlled &&
      internalIndex >= safeList.length
    ) {
      setInternalIndex(0);
    }
  }, [
    internalIndex,
    isControlled,
    safeList.length
  ]);

  useEffect(() => {
    const element = rootRef.current;

    if (!element) return undefined;

    if (
      typeof IntersectionObserver === "undefined"
    ) {
      setReady(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        setReady(true);
        observer.disconnect();
      },
      {
        rootMargin: "150px"
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !hasMultipleImages) return;

    const nextIndex =
      (activeIndex + 1) % safeList.length;

    const preloadImage = new Image();

    preloadImage.src = resolveImageUrl(
      safeList[nextIndex]
    );
  }, [
    activeIndex,
    hasMultipleImages,
    ready,
    safeList
  ]);

  const handlePointerDown = (event) => {
    if (
      !hasMultipleImages ||
      event.target.closest(
        "button, a, input, select, textarea"
      )
    ) {
      return;
    }

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    startXRef.current = event.clientX;
    pointerIdRef.current = event.pointerId;
    draggedRef.current = false;

    setDragging(true);
    setDragOffset(0);

    event.currentTarget.setPointerCapture?.(
      event.pointerId
    );
  };

  const handlePointerMove = (event) => {
    if (
      pointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    const width =
      rootRef.current?.clientWidth || 1;

    const distance =
      event.clientX - startXRef.current;

    const limitedDistance = Math.max(
      -width,
      Math.min(width, distance)
    );

    if (
      Math.abs(distance) > DRAG_THRESHOLD
    ) {
      draggedRef.current = true;
    }

    setDragOffset(limitedDistance);
  };

  const finishPointer = (
    event,
    allowChange = true
  ) => {
    if (
      pointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    const distance =
      event.clientX - startXRef.current;

    if (
      allowChange &&
      Math.abs(distance) > CHANGE_THRESHOLD
    ) {
      setIndex(
        activeIndex +
          (distance < 0 ? 1 : -1)
      );
    }

    if (
      event.currentTarget.hasPointerCapture?.(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture?.(
        event.pointerId
      );
    }

    pointerIdRef.current = null;

    setDragging(false);
    setDragOffset(0);

    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  const handleOpen = (event) => {
    if (draggedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onOpen?.();
  };

  const handleKeyDown = (event) => {
    if (!hasMultipleImages) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIndex(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setIndex(activeIndex + 1);
    }
  };

  const handleImageError = (event) => {
    const element = event.currentTarget;

    if (element.dataset.fallback) return;

    element.dataset.fallback = "1";
    element.src = "/placeholder.png";
  };

  return (
    <div
      ref={rootRef}
      className={[
        "costume-image-carousel",
        `costume-image-carousel--${variant}`,
        dragging ? "is-dragging" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-roledescription="carousel"
      aria-label={`Hình ảnh ${name}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) =>
        finishPointer(event, true)
      }
      onPointerCancel={(event) =>
        finishPointer(event, false)
      }
      onClick={handleOpen}
      onMouseEnter={() => setReady(true)}
    >
      <div
        className="costume-image-carousel__track"
        style={{
          transform: `translate3d(calc(-${
            activeIndex * 100
          }% + ${dragOffset}px), 0, 0)`,
          transition: dragging
            ? "none"
            : undefined
        }}
      >
        {safeList.map((src, imageIndex) => (
          <div
            className="costume-image-carousel__slide"
            key={`${src}-${imageIndex}`}
            aria-hidden={
              imageIndex !== activeIndex
            }
          >
            <img
              src={resolveImageUrl(src)}
              alt={`${name} - ảnh ${imageIndex + 1}`}
              width={variant === "detail" ? 1200 : 720}
              height={variant === "detail" ? 1500 : 900}
              fetchpriority={variant === "detail" && imageIndex === 0 ? "high" : "auto"}
              loading={
                imageIndex === 0
                  ? "eager"
                  : "lazy"
              }
              draggable={false}
              onDragStart={(event) =>
                event.preventDefault()
              }
              onError={handleImageError}
            />
          </div>
        ))}
      </div>

      {hasMultipleImages && (
        <>
          {showArrows && (
            <>
              <button
                type="button"
                className="costume-image-carousel__arrow prev"
                aria-label="Ảnh trước"
                onClick={(event) => {
                  event.stopPropagation();
                  setIndex(activeIndex - 1);
                }}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                className="costume-image-carousel__arrow next"
                aria-label="Ảnh tiếp theo"
                onClick={(event) => {
                  event.stopPropagation();
                  setIndex(activeIndex + 1);
                }}
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {showCounter && (
            <span className="costume-image-carousel__counter">
              {activeIndex + 1}/{safeList.length}
            </span>
          )}

          {showDots && (
            <div className="costume-image-carousel__dots">
              {safeList
                .slice(0, 6)
                .map((src, imageIndex) => (
                  <button
                    type="button"
                    key={`${src}-dot-${imageIndex}`}
                    aria-label={`Ảnh ${imageIndex + 1}`}
                    aria-current={
                      imageIndex === activeIndex
                        ? "true"
                        : undefined
                    }
                    className={
                      imageIndex === activeIndex
                        ? "active"
                        : ""
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      setIndex(imageIndex);
                    }}
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
