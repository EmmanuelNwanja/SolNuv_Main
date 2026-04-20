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
import { pitchdeckAPI } from "../../services/api";

type ViewResponse = {
  count: number;
  source: string;
  updatedAt: string;
};

type PublicMetric = {
  metric_key: string;
  value: number | string | null;
  liveFetched?: boolean;
};

type PublicCard = {
  id: string;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
};

type PublicSlide = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  cards?: PublicCard[];
};

type PublicDeckPayload = {
  slides: PublicSlide[];
  metrics: PublicMetric[];
};

export function PitchCarusel() {
  const [views, setViews] = useState(0);
  const called = useRef(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [loadingViews, setLoadingViews] = useState(true);
  const [managedDeck, setManagedDeck] = useState<PublicDeckPayload | null>(null);

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
    async function loadManagedDeck() {
      try {
        const response = await pitchdeckAPI.getPublicDeck("pitch");
        const data = response.data?.data;
        if (data && Array.isArray(data.slides) && data.slides.length > 0) {
          setManagedDeck({
            slides: data.slides as PublicSlide[],
            metrics: (data.metrics || []) as PublicMetric[],
          });
        }
      } catch {
        setManagedDeck(null);
      }
    }
    void loadManagedDeck();
  }, []);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  function resolveText(template: string | null | undefined) {
    if (!template) return "";
    if (!managedDeck?.metrics?.length) return template;
    return managedDeck.metrics.reduce((acc, metric) => {
      return acc.replaceAll(`{{${metric.metric_key}}}`, String(metric.value ?? ""));
    }, template);
  }

  return (
    <Carousel className="w-full min-h-full relative" setApi={setApi}>
      <CarouselContent>
        {managedDeck?.slides?.length ? (
          managedDeck.slides.map((slide) => (
            <CarouselItem key={slide.id}>
              <div className="container px-4 sm:px-8 py-14 md:py-16 max-w-6xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{resolveText(slide.title)}</h2>
                  {slide.subtitle && (
                    <p className="mt-3 text-base md:text-lg text-slate-300">{resolveText(slide.subtitle)}</p>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {(slide.cards || []).map((card) => (
                    <div key={card.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                      {card.title && (
                        <h3 className="text-lg font-semibold text-white">{resolveText(card.title)}</h3>
                      )}
                      {card.body && (
                        <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">
                          {resolveText(card.body)}
                        </p>
                      )}
                      {card.image_url && (
                        <img src={card.image_url} alt={card.title || "card visual"} className="mt-3 w-full rounded-md object-cover" />
                      )}
                      {card.cta_url && card.cta_label && (
                        <a
                          href={card.cta_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex mt-4 text-sm text-emerald-300 hover:text-emerald-200 underline"
                        >
                          {card.cta_label}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CarouselItem>
          ))
        ) : (
          <>
            <CarouselItem>
              <SectionStart />
            </CarouselItem>
            <CarouselItem>
              <SectionProblem />
            </CarouselItem>
            <CarouselItem>
              <SectionSolution />
            </CarouselItem>
            <CarouselItem>
              <SectionDemo playVideo={current === 4} />
            </CarouselItem>
            <CarouselItem>
              <SectionTraction />
            </CarouselItem>
            <CarouselItem>
              <SectionTeam />
            </CarouselItem>
            <CarouselItem>
              <SectionSubscription />
            </CarouselItem>
            <CarouselItem>
              <SectionVision />
            </CarouselItem>
            <CarouselItem>
              <SectionNext />
            </CarouselItem>
            <CarouselItem>
              <SectionBook />
            </CarouselItem>
          </>
        )}
      </CarouselContent>

      <CarouselToolbar views={views} loading={loadingViews} />
    </Carousel>
  );
}
