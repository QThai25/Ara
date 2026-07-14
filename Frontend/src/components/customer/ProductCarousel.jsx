import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { ProductCard } from "./ProductCard.jsx";
import { StateMessage } from "../common/StateMessage.jsx";

function getPerView() {
  if (typeof window === "undefined") return 4;

  if (window.matchMedia("(max-width: 639px)").matches) {
    return 1;
  }

  if (window.matchMedia("(max-width: 1023px)").matches) {
    return 2;
  }

  return 4;
}

function createPages(products, perView) {
  const pages = [];

  for (let index = 0; index < products.length; index += perView) {
    pages.push(products.slice(index, index + perView));
  }

  return pages;
}

export function ProductCarousel({
  title,
  products = [],
  loading = false,
  error = "",
  emptyText = "Không có sản phẩm phù hợp.",
  onOpen,
  onWishlist,
  isWishlisted
}) {
  const viewportRef = useRef(null);
  const touchStartXRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const transitionFrameRef = useRef(null);

  const [perView, setPerView] = useState(getPerView);
  const [currentPage, setCurrentPage] = useState(0);
  const [slideIndex, setSlideIndex] = useState(1);
  const [enableTransition, setEnableTransition] = useState(true);

  const pages = useMemo(
    () => createPages(products, perView),
    [products, perView]
  );

  const pageCount = pages.length;
  const canSlide = pageCount > 1;

  /*
   * Thêm một bản sao ở đầu và cuối để carousel có thể
   * chạy vòng lặp mà không giật khi chuyển trang.
   */
  const slides = useMemo(() => {
    const originalSlides = pages.map((items, index) => ({
      items,
      originalPage: index,
      key: `page-${index}`
    }));

    if (originalSlides.length <= 1) {
      return originalSlides;
    }

    return [
      {
        ...originalSlides[originalSlides.length - 1],
        key: "clone-last"
      },
      ...originalSlides,
      {
        ...originalSlides[0],
        key: "clone-first"
      }
    ];
  }, [pages]);

  useEffect(() => {
    const handleResize = () => {
      window.cancelAnimationFrame(resizeFrameRef.current);

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        setPerView(getPerView());
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(resizeFrameRef.current);
    };
  }, []);

  /*
   * Khi đổi kích thước màn hình hoặc số lượng trang thay đổi,
   * đưa carousel về trang đầu để tránh lệch vị trí.
   */
  useEffect(() => {
    setEnableTransition(false);
    setCurrentPage(0);
    setSlideIndex(canSlide ? 1 : 0);

    transitionFrameRef.current = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setEnableTransition(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(transitionFrameRef.current);
    };
  }, [canSlide, pageCount, perView]);

  const goToPage = useCallback(
    (targetPage) => {
      if (!canSlide) return;

      setEnableTransition(true);

      if (targetPage < 0) {
        setCurrentPage(pageCount - 1);
        setSlideIndex(0);
        return;
      }

      if (targetPage >= pageCount) {
        setCurrentPage(0);
        setSlideIndex(pageCount + 1);
        return;
      }

      setCurrentPage(targetPage);
      setSlideIndex(targetPage + 1);
    },
    [canSlide, pageCount]
  );

  const previous = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const next = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const handleTransitionEnd = () => {
    if (!canSlide) return;

    /*
     * Sau khi chạy tới slide bản sao, nhảy âm thầm
     * về slide thật tương ứng.
     */
    if (slideIndex === 0) {
      setEnableTransition(false);
      setSlideIndex(pageCount);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setEnableTransition(true);
        });
      });

      return;
    }

    if (slideIndex === pageCount + 1) {
      setEnableTransition(false);
      setSlideIndex(1);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setEnableTransition(true);
        });
      });
    }
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

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current === null) return;

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const distance = touchStartXRef.current - touchEndX;

    touchStartXRef.current = null;

    if (Math.abs(distance) < 45) return;

    if (distance > 0) {
      next();
    } else {
      previous();
    }
  };

  const handleDotClick = (pageIndex) => {
    if (pageIndex === currentPage) return;

    setEnableTransition(true);
    setCurrentPage(pageIndex);
    setSlideIndex(canSlide ? pageIndex + 1 : 0);
  };

  return (
    <section className="mei-products-section product-carousel">
      <div className="product-carousel-heading">
        <div className="product-carousel-title-group">

          <div className="product-carousel-title-row">
            <h2>{title}</h2>
            <span className="product-carousel-title-line" />
          </div>
        </div>

        <div className="product-carousel-navigation">
          {canSlide && (
            <span className="product-carousel-counter">
              {String(currentPage + 1).padStart(2, "0")}
              <i />
              {String(pageCount).padStart(2, "0")}
            </span>
          )}

          <button
            type="button"
            className="product-carousel-arrow"
            aria-label="Xem sản phẩm trước"
            onClick={previous}
            disabled={!canSlide}
          >
            <ChevronLeft size={20} strokeWidth={1.6} />
          </button>

          <button
            type="button"
            className="product-carousel-arrow"
            aria-label="Xem sản phẩm tiếp theo"
            onClick={next}
            disabled={!canSlide}
          >
            <ChevronRight size={20} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {loading && (
        <StateMessage text="Đang tải sản phẩm..." />
      )}

      {error && (
        <StateMessage
          text={error}
          tone="error"
        />
      )}

      {!loading && !error && products.length === 0 && (
        <StateMessage text={emptyText} />
      )}

      {!loading && !error && products.length > 0 && (
        <>
          <div
            ref={viewportRef}
            className="product-carousel-viewport"
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label={title}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className={`product-carousel-track ${
                enableTransition ? "is-animated" : ""
              }`}
              style={{
                transform: `translate3d(-${slideIndex * 100}%, 0, 0)`
              }}
              onTransitionEnd={handleTransitionEnd}
            >
              {slides.map((slide, slidePosition) => (
                <div
                  className="product-carousel-page"
                  key={slide.key}
                  aria-hidden={
                    slide.originalPage !== currentPage
                  }
                >
                  <div
                    className="mei-product-grid product-carousel-grid"
                    style={{
                      gridTemplateColumns: `repeat(${perView}, minmax(0, 1fr))`
                    }}
                  >
                    {slide.items.map((product, productIndex) => {
                      const productId =
                        product.id || product._id;

                      return (
                        <div
                          className="product-carousel-item"
                          key={`${slidePosition}-${productId}`}
                        >
                          <ProductCard
                            product={product}
                            index={
                              slide.originalPage * perView +
                              productIndex
                            }
                            onOpen={onOpen}
                            onWishlist={onWishlist}
                            wishlisted={isWishlisted?.(
                              productId
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canSlide && (
            <div
              className="carousel-dots"
              aria-label="Chọn trang sản phẩm"
            >
              {pages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={
                    index === currentPage
                      ? "active"
                      : ""
                  }
                  aria-label={`Trang ${index + 1}`}
                  aria-current={
                    index === currentPage
                      ? "true"
                      : undefined
                  }
                  onClick={() =>
                    handleDotClick(index)
                  }
                >
                  <span />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}