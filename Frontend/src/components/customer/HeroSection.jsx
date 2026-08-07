import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { paths, views } from "../../routes/views.js";
import { normalizeImageList, resolveImageUrl } from "../../utils/format.js";

const DEFAULT_BANNER = {
  id: "default-hero",
  title: "Khám phá thiết kế dành riêng cho bạn",
  subtitle:
    "Khám phá những thiết kế thanh lịch, tinh tế dành riêng cho từng khoảnh khắc của bạn.",
  buttonText: "Thuê ngay",
  buttonLink: paths.catalog
};

export function HeroSectionSkeleton() {
  return (
    <section
      className="mei-hero ara-hero hero-carousel ara-hero-skeleton"
      aria-label="Đang tải banner nổi bật"
      aria-busy="true"
    >
      <div className="ara-hero-skeleton__viewport">
        <div className="ara-hero-skeleton__media" />
        <div className="ara-hero-skeleton__content">
          <span className="ara-hero-skeleton__eyebrow" />
          <span className="ara-hero-skeleton__title" />
          <span className="ara-hero-skeleton__line" />
          <span className="ara-hero-skeleton__line ara-hero-skeleton__line--short" />
          <span className="ara-hero-skeleton__actions" />
          <span className="ara-hero-skeleton__gallery" />
        </div>
      </div>
    </section>
  );
}

function splitHeroTitle(title = "") {
  const words = title.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 2) {
    return {
      first: title,
      highlight: ""
    };
  }

  const highlightCount =
    words.length >= 6 ? 3 :
      words.length >= 4 ? 2 :
        1;

  return {
    first: words.slice(0, -highlightCount).join(" "),
    highlight: words.slice(-highlightCount).join(" ")
  };
}

function getHeroCopy(slide) {
  const title = String(slide.title || "").trim();
  const subtitle = String(slide.subtitle || "").trim();
  const isNewCustomerPromotion = title.toLocaleLowerCase() === "khuyến mãi khách hàng mới";
  const isLegacyPromotionSubtitle = /khuyến mãi 10% cho đơn đầu tiên/i.test(subtitle);

  return {
    title: isNewCustomerPromotion ? "Ưu đãi dành cho khách hàng mới" : title || DEFAULT_BANNER.title,
    subtitle: isLegacyPromotionSubtitle
      ? "Nhận ưu đãi 10% cho đơn thuê đầu tiên khi đăng ký tài khoản tại Ara Dress."
      : subtitle || DEFAULT_BANNER.subtitle,
    buttonText: isNewCustomerPromotion
      ? "Đăng ký nhận ưu đãi"
      : String(slide.buttonText || "").replace(/đăng kí/gi, "đăng ký") || "Thuê ngay"
  };
}

export function HeroSection({
  products = [],
  banners = [],
  banner,
  setView,
  autoPlay = true,
  autoPlayDelay = 6500
}) {
  const viewportRef = useRef(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const pointerIdRef = useRef(null);

  const [page, setPage] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [paused, setPaused] = useState(false);

  const slides = useMemo(() => {
    const activeBanners = banners.length
      ? [...banners].sort((left, right) => Number(Boolean(right.isPrimary)) - Number(Boolean(left.isPrimary)) || Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
      : [banner].filter(Boolean);

    const baseSlides = activeBanners.length ? activeBanners : [DEFAULT_BANNER];

    return baseSlides.map((item, index) => {
      const bannerImages = normalizeImageList(item.images, item.image, 6);

      return {
        ...DEFAULT_BANNER,
        ...item,
        id: item.id || item._id || `hero-${index}`,
        gallery: bannerImages.map((image, imageIndex) => ({
          id: `${item.id || item._id || index}-image-${imageIndex}`,
          name: item.title || "Ara banner",
          image
        }))
      };
    });
  }, [banner, banners]);

  const slideCount = slides.length;
  const canSlide = slideCount > 1;

  useEffect(() => {
    setPage((current) =>
      Math.min(current, Math.max(0, slideCount - 1))
    );
  }, [slideCount]);

  const goToPage = useCallback(
    (nextPage) => {
      if (!slideCount) return;

      const normalizedPage =
        (nextPage + slideCount) % slideCount;

      setDragOffset(0);
      setPage(normalizedPage);
    },
    [slideCount]
  );

  const previous = useCallback(() => {
    goToPage(page - 1);
  }, [goToPage, page]);

  const next = useCallback(() => {
    goToPage(page + 1);
  }, [goToPage, page]);

  useEffect(() => {
    if (
      !autoPlay ||
      !canSlide ||
      paused ||
      isDragging
    ) {
      return undefined;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      return undefined;
    }

    const timer = window.setTimeout(
      next,
      autoPlayDelay
    );

    return () => window.clearTimeout(timer);
  }, [
    autoPlay,
    autoPlayDelay,
    canSlide,
    isDragging,
    next,
    page,
    paused
  ]);

  const finishDragging = useCallback(
    (clientX, allowNavigation = true) => {
      if (!draggingRef.current) return;

      const viewportWidth =
        viewportRef.current?.clientWidth || 1;

      const distance =
        clientX - startXRef.current;

      const threshold = Math.min(
        110,
        viewportWidth * 0.14
      );

      draggingRef.current = false;
      pointerIdRef.current = null;

      setIsDragging(false);
      setDragOffset(0);

      if (!allowNavigation) return;

      if (distance <= -threshold) {
        next();
      } else if (distance >= threshold) {
        previous();
      }
    },
    [next, previous]
  );

  const handlePointerDown = (event) => {
    if (!canSlide) return;

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    if (
      event.target.closest(
        "button, a, input, textarea, select"
      )
    ) {
      return;
    }

    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;

    setIsDragging(true);
    setDragOffset(0);

    event.currentTarget.setPointerCapture?.(
      event.pointerId
    );
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;

    const viewportWidth =
      viewportRef.current?.clientWidth || 1;

    const distance =
      event.clientX - startXRef.current;

    const limitedDistance = Math.max(
      -viewportWidth * 0.92,
      Math.min(viewportWidth * 0.92, distance)
    );

    setDragOffset(limitedDistance);
  };

  const handlePointerUp = (event) => {
    finishDragging(event.clientX, true);

    event.currentTarget.releasePointerCapture?.(
      event.pointerId
    );
  };

  const handlePointerCancel = (event) => {
    finishDragging(event.clientX, false);
  };

  const handleKeyDown = (event) => {
    if (!canSlide) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  };

  const handleOpenCatalog = (link) => {
    setView?.(
      views.catalog,
      link || paths.catalog
    );
  };

  if (!slideCount) return null;

  return (
    <section
      className="mei-hero ara-hero hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        className="ara-hero-viewport"
        role="region"
        aria-roledescription="carousel"
        aria-label="Bộ sưu tập nổi bật"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className={`ara-hero-track ${isDragging ? "is-dragging" : ""
            }`}
          style={{
            transform: `translate3d(calc(-${page * 100
              }% + ${dragOffset}px), 0, 0)`
          }}
        >
          {slides.map((slide, index) => {
            const copy = getHeroCopy(slide);
            const titleParts = splitHeroTitle(copy.title);
            const secondaryActionLink =
              slide.buttonLink || slide.link;
            const hasSecondaryAction =
              secondaryActionLink &&
              secondaryActionLink !== paths.catalog;

            const isActive = index === page;

            return (
              <article
                className={`ara-hero-slide ${isActive ? "is-active" : ""
                  }`}
                key={slide.id}
                aria-hidden={!isActive}
              >
                <div className="ara-hero-copy">
                  <div className="ara-hero-copy-inner">
                    <span className="ara-hero-eyebrow">
                      Ara dress collection
                    </span>

                    <h2 className="ara-hero-title">
                      <span>{titleParts.first}</span>

                      {titleParts.highlight && (
                        <em>{titleParts.highlight}</em>
                      )}
                    </h2>

                    <p className="ara-hero-description">
                      {copy.subtitle}
                    </p>

                    <div
                      className={`ara-hero-actions ${
                        hasSecondaryAction ? "" : "is-single"
                      }`}
                    >
                      <button
                        type="button"
                        className="ara-hero-primary"
                        tabIndex={isActive ? 0 : -1}
                        onClick={() =>
                          handleOpenCatalog(
                            paths.catalog
                          )
                        }
                      >
                        Xem bộ sưu tập

                        <ArrowUpRight
                          size={16}
                          strokeWidth={1.8}
                        />
                      </button>

                      {hasSecondaryAction && (
                        <button
                          type="button"
                          className="ara-hero-secondary"
                          tabIndex={isActive ? 0 : -1}
                          onClick={() =>
                            handleOpenCatalog(
                              secondaryActionLink
                            )
                          }
                        >
                          {copy.buttonText}
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                <div className={`ara-hero-gallery ara-hero-gallery--${Math.min(slide.gallery.length, 6)}`}>
                  {slide.gallery.map(
                    (item, imageIndex) => {
                      const image =
                        item.image ||
                        item.images?.[0];

                      return (
                        <div
                          className={`ara-hero-image ara-hero-image-${imageIndex + 1
                            }`}
                          key={
                            item.id ||
                            item._id ||
                            imageIndex
                          }
                        >
                          <img
                            src={resolveImageUrl(
                              image
                            )}
                            alt={
                              item.name ||
                              slide.title
                            }
                            width="1600"
                            height="900"
                            fetchpriority={imageIndex === 0 ? "high" : "auto"}
                            draggable="false"
                            loading={imageIndex === 0 ? "eager" : "lazy"}
                            onDragStart={(event) =>
                              event.preventDefault()
                            }
                            onError={(event) => {
                              event.currentTarget.src =
                                "/placeholder.png";
                            }}
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {canSlide && (
        <>
          <div className="ara-hero-navigation">
            <button
              type="button"
              aria-label="Banner trước"
              onClick={previous}
            >
              <ChevronLeft
                size={21}
                strokeWidth={1.6}
              />
            </button>

            <button
              type="button"
              aria-label="Banner tiếp theo"
              onClick={next}
            >
              <ChevronRight
                size={21}
                strokeWidth={1.6}
              />
            </button>
          </div>

          <div
            className="ara-hero-dots"
            aria-label="Chọn banner"
          >
            {slides.map((slide, index) => (
              <button
                type="button"
                key={slide.id}
                className={
                  index === page ? "active" : ""
                }
                aria-label={`Banner ${index + 1}`}
                aria-current={
                  index === page
                    ? "true"
                    : undefined
                }
                onClick={() => goToPage(index)}
              >
                <span />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
