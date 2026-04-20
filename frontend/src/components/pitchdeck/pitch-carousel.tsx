"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CarouselToolbar } from "./carousel-toolbar";
import { SectionBook } from "./section-book";
import { SectionDemo } from "./section-demo";
import { SectionNext } from "./section-next";
import { SectionProblem } from "./section-problem";
import { SectionSolution } from "./section-solution";
import { SectionStart } from "./section-start";
import { SectionSubscription } from "./section-subscription";
import { SectionTeam } from "./section-team";
import { SectionTraction } from "./section-traction";
import { SectionVision } from "./section-vision";

const PITCH_VIEW_KEY = "solnuv_pitchdeck_views";

export function PitchCarousel() {
  const slides = useMemo(
    () => [
      { id: "start", node: <SectionStart /> },
      { id: "problem", node: <SectionProblem /> },
      { id: "solution", node: <SectionSolution /> },
      { id: "demo", node: <SectionDemo /> },
      { id: "traction", node: <SectionTraction /> },
      { id: "team", node: <SectionTeam /> },
      { id: "model", node: <SectionSubscription /> },
      { id: "vision", node: <SectionVision /> },
      { id: "next", node: <SectionNext /> },
      { id: "book", node: <SectionBook /> },
    ],
    [],
  );
  const total = slides.length;
  const [current, setCurrent] = useState(1);
  const [views, setViews] = useState(18000);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = Number(window.localStorage.getItem(PITCH_VIEW_KEY) || 18000);
    const nextViews = Number.isFinite(saved) ? saved + 1 : 18001;
    setViews(nextViews);
    window.localStorage.setItem(PITCH_VIEW_KEY, String(nextViews));
  }, []);

  const scrollTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return;
      const target = slideRefs.current[index];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        setCurrent(index + 1);
      }
    },
    [total],
  );

  const handlePrev = useCallback(() => {
    scrollTo(Math.max(current - 2, 0));
  }, [current, scrollTo]);

  const handleNext = useCallback(() => {
    scrollTo(Math.min(current, total - 1));
  }, [current, total, scrollTo]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = slideRefs.current.findIndex((item) => item === visible.target);
        if (index >= 0) setCurrent(index + 1);
      },
      {
        root: null,
        threshold: [0.45, 0.6, 0.75],
      },
    );

    slideRefs.current.forEach((item) => {
      if (item) observer.observe(item);
    });

    return () => observer.disconnect();
  }, [total]);

  return (
    <div className="relative">
      <div className="overflow-x-auto snap-x snap-mandatory scroll-smooth pb-28 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-13rem)]">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              ref={(node) => {
                slideRefs.current[index] = node;
              }}
              className="snap-center shrink-0 w-[94vw] sm:w-[86vw] lg:w-[78vw] xl:w-[72vw] 2xl:w-[66vw] min-h-[calc(100vh-13rem)] py-4"
              aria-label={`Pitch slide ${index + 1}`}
            >
              {slide.node}
            </div>
          ))}
        </div>
      </div>
      <CarouselToolbar current={current} total={total} views={views} onPrev={handlePrev} onNext={handleNext} />
    </div>
  );
}
