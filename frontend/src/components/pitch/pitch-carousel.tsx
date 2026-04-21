"use client";

import { useEffect, useRef, useState } from "react";

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
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "../ui/carousel";
import { CarouselToolbar } from "./carousel-toolbar";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type ViewResponse = {
  count: number;
  source: string;
  updatedAt: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// Main Carousel Component
// ──────────────────────────────────────────────────────────────────────────────
// Pitch uses static Section* slides only (homepage is messaging source of truth;
// CMS- or API-backed decks are intentionally off while Content Studio is stale).

export function PitchCarusel() {
  const [views, setViews] = useState(0);
  const called = useRef(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [loadingViews, setLoadingViews] = useState(true);

  useEffect(() => {
    async function fetchViewsCount() {
      try {
        setLoadingViews(true);
        const response = await fetch("/api/pitch/views", { method: "POST" });
        const data = (await response.json()) as ViewResponse;
        setViews(Number(data?.count ?? 0));
      } catch {
        setViews(18000);
      } finally {
        setLoadingViews(false);
      }
    }

    if (!called.current) {
      void fetchViewsCount();
      called.current = true;
    }
  }, []);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap() + 1);
    api.on("select", () => setCurrent(api.selectedScrollSnap() + 1));
  }, [api]);

  return (
    <Carousel className="w-full min-h-full md:h-[100svh] relative" setApi={setApi}>
      <CarouselContent>
        <CarouselItem><SectionStart /></CarouselItem>
        <CarouselItem><SectionProblem /></CarouselItem>
        <CarouselItem><SectionSolution /></CarouselItem>
        <CarouselItem><SectionDemo playVideo={current === 4} /></CarouselItem>
        <CarouselItem><SectionTraction /></CarouselItem>
        <CarouselItem><SectionTeam /></CarouselItem>
        <CarouselItem><SectionSubscription /></CarouselItem>
        <CarouselItem><SectionVision /></CarouselItem>
        <CarouselItem><SectionNext /></CarouselItem>
        <CarouselItem><SectionBook /></CarouselItem>
      </CarouselContent>

      <CarouselToolbar views={views} loading={loadingViews} />
    </Carousel>
  );
}
