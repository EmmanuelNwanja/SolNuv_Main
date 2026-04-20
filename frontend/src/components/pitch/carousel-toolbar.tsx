"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FaXTwitter } from "react-icons/fa6";
import { useHotkeys } from "react-hotkeys-hook";

import { CopyInput } from "../copy-input";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Icons } from "../ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useCarousel } from "../ui/carousel";
import { cn } from "../../lib/utils";

type Props = {
  views: number;
  loading?: boolean;
};

const popupCenter = ({
  url,
  title,
  w,
  h,
}: {
  url: string;
  title: string;
  w: number;
  h: number;
}) => {
  const dualScreenLeft =
    window.screenLeft !== undefined ? window.screenLeft : window.screenX;
  const dualScreenTop =
    window.screenTop !== undefined ? window.screenTop : window.screenY;

  const width = window.innerWidth
    ? window.innerWidth
    : document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : screen.width;
  const height = window.innerHeight
    ? window.innerHeight
    : document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : screen.height;

  const systemZoom = width / window.screen.availWidth;
  const left = (width - w) / 2 / systemZoom + dualScreenLeft;
  const top = (height - h) / 2 / systemZoom + dualScreenTop;
  const newWindow = window.open(
    url,
    title,
    `
    scrollbars=yes,
    width=${w / systemZoom},
    height=${h / systemZoom},
    top=${top},
    left=${left}
    `,
  );

  return newWindow;
};

export function CarouselToolbar({ views, loading }: Props) {
  const api = useCarousel();

  useHotkeys("arrowRight", () => api.scrollNext(), [api]);
  useHotkeys("arrowLeft", () => api.scrollPrev(), [api]);

  const handleOnShare = () => {
    const popup = popupCenter({
      url: "https://twitter.com/intent/tweet?text=Check this pitch deck https://solnuv.com/pitch @solnuv",
      title: "Share",
      w: 800,
      h: 400,
    });

    popup?.focus();
  };

  return (
    <Dialog>
      <div className="fixed flex justify-center left-0 bottom-3 sm:bottom-5 w-full z-50 px-2 sm:px-0">
        <AnimatePresence>
          <motion.div animate={{ y: views > 0 ? 0 : 100 }} initial={{ y: 100 }}>
            <TooltipProvider delayDuration={20}>
              <div className="flex backdrop-filter backdrop-blur-lg bg-[#1A1A1A]/80 min-h-10 px-2 sm:px-4 py-2 border border-[#2C2C2C] items-center gap-2 sm:gap-4 max-w-[96vw] overflow-x-auto">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="text-[#878787] flex items-center space-x-2 border-r-[1px] border-border pr-2 sm:pr-4 shrink-0">
                      <Icons.Visibility size={18} />
                      <span className="text-sm">
                        {Intl.NumberFormat("en", {
                          notation: "compact",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 1,
                        }).format(views ?? 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide text-green-400">
                        <span
                          className={cn(
                            "inline-flex h-1.5 w-1.5 rounded-full",
                            loading ? "bg-amber-400 animate-pulse" : "bg-green-500",
                          )}
                        />
                        live
                      </span>
                    </div>
                  </TooltipTrigger>

                  <TooltipContent className="py-1 px-3 rounded-sm" sideOffset={25}>
                    <span className="text-xs">
                      {loading ? "Fetching live views..." : "Live-fetched views"}
                    </span>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => api.api?.scrollTo(100)}>
                      <Icons.Calendar size={18} className="text-[#878787]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="py-1 px-3 rounded-sm" sideOffset={25}>
                    <span className="text-xs">Book a meeting</span>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <DialogTrigger asChild>
                      <Icons.Share
                        size={18}
                        className="text-[#878787] -mt-[1px] cursor-pointer"
                      />
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="py-1 px-3 rounded-sm" sideOffset={25}>
                    <span className="text-xs">Share</span>
                  </TooltipContent>
                </Tooltip>

                <div className="flex items-center border-l-[1px] border-border pl-2 sm:pl-4 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={!api?.canScrollPrev}
                        className={cn(!api?.canScrollPrev && "opacity-50")}
                        onClick={() => {
                          api.scrollPrev();
                        }}
                      >
                        <Icons.ChevronLeft className="h-6 w-6" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="py-1 px-3 rounded-sm" sideOffset={25}>
                      <span className="text-xs">Previous slide</span>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={!api?.canScrollNext}
                        className={cn(!api?.canScrollNext && "opacity-50")}
                        onClick={() => {
                          api.scrollNext();
                        }}
                      >
                        <Icons.ChevronRight className="h-6 w-6" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="py-1 px-3 rounded-sm" sideOffset={25}>
                      <span className="text-xs">Next slide</span>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
          </motion.div>
        </AnimatePresence>
      </div>

      <DialogContent className="sm:max-w-[425px]">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>Share</DialogTitle>
          </DialogHeader>
          <DialogDescription>Thanks for sharing our pitch deck.</DialogDescription>

          <div className="grid gap-6 py-4">
            <CopyInput value="https://solnuv.com/pitch" />
            <Button className="w-full flex items-center space-x-2 h-10" onClick={handleOnShare}>
              <span>Share on</span>
              <FaXTwitter />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
